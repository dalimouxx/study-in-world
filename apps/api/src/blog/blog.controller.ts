import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import type { AuthUser, RequestMeta } from '../common/auth-user';
import { BlogService } from './blog.service';
import { CreateBlogPostDto, ListBlogPostsQuery, UpdateBlogPostDto } from './dto/blog.dto';

@ApiTags('blog')
@ApiBearerAuth()
@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get() @RequirePermissions('blog.view')
  list(@CurrentUser() user: AuthUser, @Query() q: ListBlogPostsQuery) {
    return this.blog.list(user, q);
  }

  @Get(':id') @RequirePermissions('blog.view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.blog.get(user, id);
  }

  @Post() @RequirePermissions('blog.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBlogPostDto, @ReqMeta() meta: RequestMeta) {
    return this.blog.create(user, dto, meta);
  }

  @Patch(':id') @RequirePermissions('blog.manage')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBlogPostDto, @ReqMeta() meta: RequestMeta) {
    return this.blog.update(user, id, dto, meta);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('blog.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.blog.remove(user, id, meta);
  }
}
