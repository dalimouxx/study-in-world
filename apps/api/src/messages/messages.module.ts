import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidates.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({ imports: [CandidatesModule], controllers: [MessagesController], providers: [MessagesService], exports: [MessagesService] })
export class MessagesModule {}
