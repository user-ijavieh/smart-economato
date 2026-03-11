import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';
import { User } from '../../../shared/models/user.model';
import { ToastComponent } from '../../../shared/components/layout/toast/toast.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  public messageService = inject(MessageService);

  userRole: string | null = null;
  students: User[] = [];
  loading: boolean = false;

  // Modales
  showEscalateModal = false;
  selectedStudent: User | null = null;
  escalateDurationMinutes: number = 60;

  ngOnInit(): void {
    this.userRole = this.authService.getRole();
    if (this.canManageStudents()) {
      this.loadStudents();
    }
  }

  canManageStudents(): boolean {
    return this.userRole === 'CHEF' || this.userRole === 'ADMIN';
  }

  loadStudents(): void {
    this.loading = true;
    if (this.userRole === 'CHEF') {
      this.userService.getStudents().subscribe({
        next: (response: any) => {
          console.log('Respuesta de getStudents:', response);
          if (Array.isArray(response)) {
            this.students = response;
          } else if (response && Array.isArray(response.content)) {
            this.students = response.content;
          } else {
            this.students = [];
          }
          this.loading = false;
        },
        error: (err) => {
          this.messageService.showError('Error al cargar alumnos');
          console.error(err);
          this.loading = false;
        }
      });
    } else if (this.userRole === 'ADMIN') {
      this.userService.getAllUnpaged().subscribe({
        next: (response: any) => {
          console.log('Respuesta de getAllUnpaged:', response);
          let usersArray = [];
          if (Array.isArray(response)) {
            usersArray = response;
          } else if (response && Array.isArray(response.content)) {
            usersArray = response.content;
          }
          
          // Filtrar solo usuarios que pueden ser elevados o revocados (USERS y ELEVATED)
          this.students = usersArray.filter((u: User) => u.role === 'USER' || u.role === 'ELEVATED');
          this.loading = false;
        },
        error: (err) => {
          this.messageService.showError('Error al cargar usuarios');
          console.error(err);
          this.loading = false;
        }
      });
    } else {
      this.loading = false;
    }
  }

  isElevated(user: User): boolean {
    return user.role === 'ELEVATED';
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  openEscalateModal(student: User): void {
    this.selectedStudent = student;
    this.escalateDurationMinutes = 60; // Default 1 hora
    this.showEscalateModal = true;
  }

  closeEscalateModal(): void {
    this.showEscalateModal = false;
    this.selectedStudent = null;
  }

  confirmEscalate(): void {
    if (!this.selectedStudent || this.escalateDurationMinutes <= 0) return;

    this.userService.escalateUser(this.selectedStudent.id, this.escalateDurationMinutes).subscribe({
      next: () => {
        this.messageService.showSuccess(`Permisos elevados para ${this.selectedStudent!.name}`);
        this.closeEscalateModal();
        this.loadStudents();
      },
      error: (err) => {
        this.messageService.showError('Error al elevar permisos');
        console.error(err);
        this.closeEscalateModal();
      }
    });
  }

  revokePermissions(student: User): void {
    if (confirm(`¿Estás seguro de que quieres revocar los permisos de ${student.name}?`)) {
      this.userService.deescalateUser(student.id).subscribe({
        next: () => {
          this.messageService.showSuccess(`Permisos revocados para ${student.name}`);
          this.loadStudents();
        },
        error: (err) => {
          this.messageService.showError('Error al revocar permisos');
          console.error(err);
        }
      });
    }
  }
}
