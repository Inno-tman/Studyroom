import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Message } from '../../shared/models/message.model';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hubConnection!: signalR.HubConnection;
  private messageSubject = new Subject<Message>();
  private userJoinedSubject = new Subject<any>();
  private userLeftSubject = new Subject<any>();
  private onlineUsersSubject = new Subject<string[]>();
  private timerStartedSubject = new Subject<any>();
  private timerPausedSubject = new Subject<any>();
  private timerResetSubject = new Subject<any>();
  private timerCompletedSubject = new Subject<any>();
  private notesUpdatedSubject = new Subject<any>();

  message$ = this.messageSubject.asObservable();
  userJoined$ = this.userJoinedSubject.asObservable();
  userLeft$ = this.userLeftSubject.asObservable();
  onlineUsers$ = this.onlineUsersSubject.asObservable();
  timerStarted$ = this.timerStartedSubject.asObservable();
  timerPaused$ = this.timerPausedSubject.asObservable();
  timerReset$ = this.timerResetSubject.asObservable();
  timerCompleted$ = this.timerCompletedSubject.asObservable();
  notesUpdated$ = this.notesUpdatedSubject.asObservable();

  constructor(private authService: AuthService) {}

  async startConnection(): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.signalrUrl, {
        accessTokenFactory: () => this.authService.getToken() || ''
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ReceiveMessage', (msg: Message) => this.messageSubject.next(msg));
    this.hubConnection.on('UserJoined', (data: any) => this.userJoinedSubject.next(data));
    this.hubConnection.on('UserLeft', (data: any) => this.userLeftSubject.next(data));
    this.hubConnection.on('OnlineUsers', (users: string[]) => this.onlineUsersSubject.next(users));
    this.hubConnection.on('TimerStarted', (data: any) => this.timerStartedSubject.next(data));
    this.hubConnection.on('TimerPaused', (data: any) => this.timerPausedSubject.next(data));
    this.hubConnection.on('TimerReset', (data: any) => this.timerResetSubject.next(data));
    this.hubConnection.on('TimerCompleted', (data: any) => this.timerCompletedSubject.next(data));
    this.hubConnection.on('NotesUpdated', (data: any) => this.notesUpdatedSubject.next(data));

    await this.hubConnection.start();
  }

  async joinRoom(roomId: string): Promise<void> {
    await this.hubConnection.invoke('JoinRoom', roomId);
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.hubConnection.invoke('LeaveRoom', roomId);
  }

  async sendMessage(roomId: string, content: string): Promise<void> {
    await this.hubConnection.invoke('SendMessage', roomId, content);
  }

  async startTimer(roomId: string, durationMinutes: number): Promise<void> {
    await this.hubConnection.invoke('StartTimer', roomId, durationMinutes);
  }

  async pauseTimer(roomId: string): Promise<void> {
    await this.hubConnection.invoke('PauseTimer', roomId);
  }

  async resetTimer(roomId: string): Promise<void> {
    await this.hubConnection.invoke('ResetTimer', roomId);
  }

  async timerCompleted(roomId: string): Promise<void> {
    await this.hubConnection.invoke('TimerCompleted', roomId);
  }

  async updateNotes(roomId: string, content: string): Promise<void> {
    await this.hubConnection.invoke('UpdateNotes', roomId, content);
  }

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
    }
  }
}
