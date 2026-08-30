import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ProfileReminderComponent } from './shared/components/profile-reminder/profile-reminder.component';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette.component';
import { PresenceDockComponent } from './shared/components/presence-dock/presence-dock.component';
import { CallOverlayComponent } from './shared/components/call-overlay/call-overlay.component';
import { YoutubePlayerComponent } from './shared/components/youtube-player/youtube-player.component';
import { GlobalAssistantComponent } from './shared/components/global-assistant/global-assistant.component';
import { RoomTabBarComponent } from './shared/components/room-tab-bar/room-tab-bar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ProfileReminderComponent, CommandPaletteComponent, PresenceDockComponent, CallOverlayComponent, YoutubePlayerComponent, GlobalAssistantComponent, RoomTabBarComponent],
  template: `
    <div class="app-container">
      <app-navbar />
      <div class="main-wrapper">
        <app-profile-reminder />
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
      <app-room-tab-bar />
      <app-command-palette />
      <app-presence-dock />
      <app-call-overlay />
      <app-youtube-player />
      <app-global-assistant />
    </div>
  `,
  styles: [``]
})
export class AppComponent {}