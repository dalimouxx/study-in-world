import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { BlogPostStatus } from '@prisma/client';
import { PaginationQuery } from '../../common/pagination';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export class CreateBlogPostDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @Transform(trim) @IsString() @MinLength(10) @MaxLength(300) excerpt!: string;
  @IsString() @MinLength(20) content!: string;
  @IsOptional() @Transform(trim) @IsUrl() coverImageUrl?: string;
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? slugify(value) : value)) @IsString() slug?: string;
}

export class UpdateBlogPostDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(10) @MaxLength(300) excerpt?: string;
  @IsOptional() @IsString() @MinLength(20) content?: string;
  @IsOptional() @Transform(trim) @IsUrl() coverImageUrl?: string;
  @IsOptional() @IsEnum(BlogPostStatus) status?: BlogPostStatus;
}

export class ListBlogPostsQuery extends PaginationQuery {
  @IsOptional() @IsEnum(BlogPostStatus) status?: BlogPostStatus;
}

export { slugify };
