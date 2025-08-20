import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_users_email', { unique: true })
  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column()
  @Exclude({ toPlainOnly: true })
  password: string;

  @Column({ default: 'user' })
  role: string;

  @Exclude({ toPlainOnly: true })
  @Column({ name: 'refresh_token_hash', type: 'varchar', nullable: true })
  refreshTokenHash?: string | null;

  @OneToMany(() => Task, (task) => task.user)
  tasks: Task[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
} 