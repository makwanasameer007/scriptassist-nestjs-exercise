import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../enums/task-status.enum';
import { TaskPriority } from '../enums/task-priority.enum';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class TaskFilterDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Free text search in title/description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter tasks due after this date (inclusive)', example: '2025-01-01T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter tasks due before this date (inclusive)', example: '2025-12-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 10 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort by field', enum: ['createdAt', 'updatedAt', 'dueDate', 'priority', 'status'] })
  @IsIn(['createdAt', 'updatedAt', 'dueDate', 'priority', 'status'])
  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'status' = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  // Only honored for admins; for normal users, derived from JWT
  @ApiPropertyOptional({ description: 'Filter by user id (admin only)' })
  @IsUUID()
  @IsOptional()
  userId?: string;
}