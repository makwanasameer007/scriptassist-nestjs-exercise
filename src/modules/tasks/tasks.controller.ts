import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, HttpException, HttpStatus, Req } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Task } from './entities/task.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskFilterDto } from './dto/task-filter.dto';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@RateLimit({ limit: 200, windowMs: 60_000 })
@ApiBearerAuth()
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() createTaskDto: CreateTaskDto, @Req() req: any) {
    const dto = { ...createTaskDto, userId: req.user.id };
    return this.tasksService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Find all tasks with filtering and pagination' })
  async findAll(@Query() filter: TaskFilterDto, @Req() req: any) {
    return this.tasksService.findAllPaginated(filter, req.user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  async getStats(@Req() req: any) {
    return this.tasksService.getStatistics(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find a task by ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.findOneOrThrow(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @Req() req: any) {
    return this.tasksService.update(id, updateTaskDto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.tasksService.remove(id, req.user);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch process multiple tasks' })
  async batchProcess(@Body() operations: { tasks: string[]; action: 'complete' | 'delete' }, @Req() req: any) {
    const { tasks: taskIds, action } = operations;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new HttpException('No tasks provided', HttpStatus.BAD_REQUEST);
    }
    switch (action) {
      case 'complete':
        return this.tasksService.completeMany(taskIds, req.user);
      case 'delete':
        return this.tasksService.deleteMany(taskIds, req.user);
      default:
        throw new HttpException(`Unknown action: ${action}`, HttpStatus.BAD_REQUEST);
    }
  }
} 