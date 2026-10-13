import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { PublicBlogController } from './public/public-blog.controller';

@Module({ controllers: [BlogController, PublicBlogController], providers: [BlogService] })
export class BlogModule {}
