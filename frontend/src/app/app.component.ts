import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ProfileReminderComponent } from './shared/components/profile-reminder/profile-reminder.component';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette.component';
import { PresenceDockComponent } from './shared/components/presence-dock/presence-dock.component';
import { CallOverlayComponent } from './shared/components/call-overlay/call-overlay.component';
import { YoutubePlayerComponent } from './shared/components/youtube-player/youtube-player.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ProfileReminderComponent, CommandPaletteComponent, PresenceDockComponent, CallOverlayComponent, YoutubePlayerComponent],
  template: `
    <div class="app-container">
      <app-navbar />
      <div class="main-wrapper">
        <app-profile-reminder />
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
      <app-command-palette />
      <app-presence-dock />
      <app-call-overlay />
      <app-youtube-player *ngIf="showPlayer()" />
    </div>
  `,
  styles: [``]
})
export class AppComponent {
  private readonly router = inject(Router);
  showPlayer = signal(false);

  constructor() {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(() => {
      const url = this.router.url;
      const isAuthScreen = url.startsWith('/login') || url.startsWith('/register');
      this.showPlayer.set(!isAuthScreen);
    });
  }
}