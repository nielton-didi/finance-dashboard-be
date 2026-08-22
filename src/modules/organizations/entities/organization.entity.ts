import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'nvarchar', length: 255 })
  name: string;

  @Column({
    name: 'registration_number',
    type: 'nvarchar',
    length: 100,
    nullable: true,
  })
  registrationNumber: string | null;

  @Column({ type: 'nvarchar', length: 100, nullable: true })
  plan: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
