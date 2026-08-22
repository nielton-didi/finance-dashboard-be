import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '../../common/auth/role';

export enum UserStatus {
  Active = 'active',
  Invited = 'invited',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ name: 'full_name', type: 'nvarchar', length: 255 })
  fullName: string;

  @Column({ type: 'nvarchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'nvarchar', length: 50, nullable: true })
  phone: string | null;

  @Exclude()
  @Column({ name: 'password_hash', type: 'nvarchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'simple-enum', enum: Role, default: Role.Staff })
  role: Role;

  @Column({
    type: 'simple-enum',
    enum: UserStatus,
    default: UserStatus.Active,
  })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
