import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ProfileReminderComponent } from './shared/components/profile-reminder/profile-reminder.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ProfileReminderComponent],
  template: `
    <div class="app-container">
      <app-sidebar />
      <div class="main-wrapper">
        <app-profile-reminder />
        <main class="main-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class AppComponent {}
