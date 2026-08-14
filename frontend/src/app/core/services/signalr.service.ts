import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Message } from '../../shared/models/message.model';
import { DirectMessage } from '../../shared/models/social.model';
import { NotificationItem } from '../../shared/models/notification.model';

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
  private directMessageSubject = new Subject<DirectMessage>();
  private notificationSubject = new Subject<NotificationItem>();
  private messageDeletedSubject = new Subject<string>();
  private incomingCallSubject = new Subject<any>();
  private callAcceptedSubject = new Subject<any>();
  private callDeclinedSubject = new Subject<any>();
  private callCancelledSubject = new Subject<any>();
  private callEndedSubject = new Subject<any>();
  private webRtcOfferSubject = new Subject<any>();
  private webRtcAnswerSubject = new Subject<any>();
  private webRtcIceSubject = new Subject<any>();

  message$ = this.messageSubject.asObservable();
  userJoined$ = this.userJoinedSubject.asObservable();
  userLeft$ = this.userLeftSubject.asObservable();
  onlineUsers$ = this.onlineUsersSubject.asObservable();
  timerStarted$ = this.timerStartedSubject.asObservable();
  timerPaused$ = this.timerPausedSubject.asObservable();
  timerReset$ = this.timerResetSubject.asObservable();
  timerCompleted$ = this.timerCompletedSubject.asObservable();
  notesUpdated$ = this.notesUpdatedSubject.asObservable();
  directMessage$ = this.directMessageSubject.asObservable();
  notification$ = this.notificationSubject.asObservable();
  messageDeleted$ = this.messageDeletedSubject.asObservable();
  incomingCall$ = this.incomingCallSubject.asObservable();
  callAccepted$ = this.callAcceptedSubject.asObservable();
  callDeclined$ = this.callDeclinedSubject.asObservable();
  callCancelled$ = this.callCancelledSubject.asObservable();
  callEnded$ = this.callEndedSubject.asObservable();
  webRtcOffer$ = this.webRtcOfferSubject.asObservable();
  webRtcAnswer$ = this.webRtcAnswerSubject.asObservable();
  webRtcIce$ = this.webRtcIceSubject.asObservable();

  constructor(private authService: AuthService) {}

  connectionActive(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }

  async startConnection(): Promise<void> {
    if (this.connectionActive()) return;

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
    this.hubConnection.on('ReceiveDirectMessage', (msg: DirectMessage) => this.directMessageSubject.next(msg));
    this.hubConnection.on('ReceiveNotification', (notification: NotificationItem) => this.notificationSubject.next(notification));
    this.hubConnection.on('MessageDeleted', (messageId: string) => this.messageDeletedSubject.next(messageId));
    this.hubConnection.on('IncomingCall', (data: any) => this.incomingCallSubject.next(data));
    this.hubConnection.on('CallAccepted', (data: any) => this.callAcceptedSubject.next(data));
    this.hubConnection.on('CallDeclined', (data: any) => this.callDeclinedSubject.next(data));
    this.hubConnection.on('CallCancelled', (data: any) => this.callCancelledSubject.next(data));
    this.hubConnection.on('CallEnded', (data: any) => this.callEndedSubject.next(data));
    this.hubConnection.on('WebRtcOffer', (data: any) => this.webRtcOfferSubject.next(data));
    this.hubConnection.on('WebRtcAnswer', (data: any) => this.webRtcAnswerSubject.next(data));
    this.hubConnection.on('WebRtcIceCandidate', (data: any) => this.webRtcIceSubject.next(data));

    await this.hubConnection.start();
  }

  async joinRoom(roomId: string): Promise<void> {
    await this.hubConnection.invoke('JoinRoom', roomId);
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.hubConnection.invoke('LeaveRoom', roomId);
  }

  async getPresence(): Promise<any[]> {
    return await this.hubConnection.invoke('GetPresence');
  }

  async ring(calleeId: string, callId: string): Promise<void> {
    await this.hubConnection.invoke('Ring', calleeId, callId);
  }

  async answerCall(callId: string): Promise<void> {
    await this.hubConnection.invoke('AnswerCall', callId);
  }

  async declineCall(callId: string): Promise<void> {
    await this.hubConnection.invoke('DeclineCall', callId);
  }

  async cancelCall(callId: string): Promise<void> {
    await this.hubConnection.invoke('CancelCall', callId);
  }

  async endCall(callId: string): Promise<void> {
    await this.hubConnection.invoke('EndCall', callId);
  }

  async sendOffer(callId: string, sdp: string): Promise<void> {
    await this.hubConnection.invoke('SendOffer', callId, sdp);
  }

  async sendAnswer(callId: string, sdp: string): Promise<void> {
    await this.hubConnection.invoke('SendAnswer', callId, sdp);
  }

  async sendIceCandidate(callId: string, candidate: string): Promise<void> {
    await this.hubConnection.invoke('SendIceCandidate', callId, candidate);
  }

  async sendMessage(roomId: string, content: string): Promise<void> {
    await this.hubConnection.invoke('SendMessage', roomId, content);
  }

  async sendDirectMessage(receiverId: string, content: string): Promise<void> {
    await this.hubConnection.invoke('SendDirectMessage', receiverId, content);
  }

  async deleteDirectMessage(messageId: string): Promise<void> {
    await this.hubConnection.invoke('DeleteDirectMessage', messageId);
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
