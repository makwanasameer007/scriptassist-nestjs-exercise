import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { TaskFilterDto } from './dto/task-filter.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
  ) {}

  private readonly logger = new Logger(TasksService.name);

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const task = this.tasksRepository.create(createTaskDto);
    const savedTask = await this.tasksRepository.save(task);
    try {
      await this.taskQueue.add(
        'task-status-update',
        {
          taskId: savedTask.id,
          status: savedTask.status,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 500 } },
      );
    } catch (error) {
      this.logger.error(`Failed to enqueue status update for task ${savedTask.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return savedTask;
  }

  async findAllPaginated(filter: TaskFilterDto, currentUser: { id: string; role?: string }) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const qb = this.tasksRepository.createQueryBuilder('task');
    qb.leftJoinAndSelect('task.user', 'user');

    // Ownership enforcement (non-admins only see their tasks)
    if (!currentUser?.role || currentUser.role !== 'admin') {
      qb.andWhere('task.userId = :userId', { userId: currentUser.id });
    } else if (filter.userId) {
      qb.andWhere('task.userId = :userId', { userId: filter.userId });
    }

    if (filter.status) qb.andWhere('task.status = :status', { status: filter.status });
    if (filter.priority) qb.andWhere('task.priority = :priority', { priority: filter.priority });
    if (filter.fromDate) qb.andWhere('task.dueDate >= :fromDate', { fromDate: filter.fromDate });
    if (filter.toDate) qb.andWhere('task.dueDate <= :toDate', { toDate: filter.toDate });
    if (filter.search) {
      qb.andWhere('(task.title ILIKE :q OR task.description ILIKE :q)', { q: `%${filter.search}%` });
    }

    const sortBy = filter.sortBy ?? 'createdAt';
    const sortOrder = filter.sortOrder ?? 'DESC';
    qb.orderBy(`task.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOneOrThrow(id: string, currentUser: { id: string; role?: string }): Promise<Task> {
    const where: any = { id };
    if (!currentUser?.role || currentUser.role !== 'admin') {
      where.userId = currentUser.id;
    }
    const task = await this.tasksRepository.findOne({ where, relations: ['user'] });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, currentUser: { id: string; role?: string }): Promise<Task> {
    const task = await this.findOneOrThrow(id, currentUser);
    const originalStatus = task.status;
    this.tasksRepository.merge(task, updateTaskDto);
    const updatedTask = await this.tasksRepository.save(task);
    if (originalStatus !== updatedTask.status) {
      try {
        await this.taskQueue.add(
          'task-status-update',
          {
            taskId: updatedTask.id,
            status: updatedTask.status,
          },
          { attempts: 3, backoff: { type: 'exponential', delay: 500 } },
        );
      } catch (error) {
        this.logger.error(`Failed to enqueue status update for task ${updatedTask.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    return updatedTask;
  }

  async remove(id: string, currentUser: { id: string; role?: string }): Promise<{ success: boolean }> {
    // Enforce ownership
    await this.findOneOrThrow(id, currentUser);
    const result = await this.tasksRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('Task not found');
    }
    return { success: true };
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return this.tasksRepository.find({ where: { status } });
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    // This method will be called by the task processor
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    task.status = status as any;
    return this.tasksRepository.save(task);
  }

  async completeMany(ids: string[], currentUser: { id: string; role?: string }) {
    // Enforce user ownership by reducing the set to owned tasks (unless admin)
    const ownedIds = await this.filterOwnedIds(ids, currentUser);
    if (ownedIds.length === 0) return { affected: 0 };
    const result = await this.tasksRepository
      .createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatus.COMPLETED })
      .where('id IN (:...ids)', { ids: ownedIds })
      .execute();
    return { affected: result.affected ?? 0 };
  }

  async deleteMany(ids: string[], currentUser: { id: string; role?: string }) {
    const ownedIds = await this.filterOwnedIds(ids, currentUser);
    if (ownedIds.length === 0) return { affected: 0 };
    const result = await this.tasksRepository.delete({ id: In(ownedIds) });
    return { affected: result.affected ?? 0 };
  }

  private async filterOwnedIds(ids: string[], currentUser: { id: string; role?: string }): Promise<string[]> {
    if (currentUser?.role === 'admin') return ids;
    const tasks = await this.tasksRepository.find({ where: { id: In(ids), userId: currentUser.id }, select: ['id'] });
    return tasks.map((t) => t.id);
  }

  async getStatistics(currentUser: { id: string; role?: string }) {
    const qb = this.tasksRepository.createQueryBuilder('task');
    if (!currentUser?.role || currentUser.role !== 'admin') {
      qb.where('task.userId = :userId', { userId: currentUser.id });
    }
    const result = await qb
      .select([
        'COUNT(task.id) as total',
        `SUM(CASE WHEN task.status = :completed THEN 1 ELSE 0 END) as completed`,
        `SUM(CASE WHEN task.status = :inProgress THEN 1 ELSE 0 END) as inProgress`,
        `SUM(CASE WHEN task.status = :pending THEN 1 ELSE 0 END) as pending`,
        `SUM(CASE WHEN task.priority = :high THEN 1 ELSE 0 END) as highPriority`,
      ])
      .setParameters({
        completed: TaskStatus.COMPLETED,
        inProgress: TaskStatus.IN_PROGRESS,
        pending: TaskStatus.PENDING,
        high: 'HIGH',
      })
      .getRawOne();
    return {
      total: Number(result.total) || 0,
      completed: Number(result.completed) || 0,
      inProgress: Number(result.inProgress) || 0,
      pending: Number(result.pending) || 0,
      highPriority: Number(result.highPriority) || 0,
    };
  }
}
