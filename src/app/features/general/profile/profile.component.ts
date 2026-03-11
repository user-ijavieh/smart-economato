import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../shared/models/user.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);

  currentUser: User | null = null;
  userInitials: string = '';
  isChef: boolean = false;
  
  students: User[] = [];
  loadingStudents = false;
  
  // Modal
  showEscalateModal = false;
  selectedStudent: User | null = null;
  durationInput = 60;
  
  // Control de estado loading por botón de alumno
  processingIds = new Set<number>();

  ngOnInit(): void {
    const role = this.authService.getRole();
    this.isChef = role === 'CHEF' || role === 'ADMIN';

    this.loadCurrentUser();

    if (this.isChef) {
      this.loadStudents();
    }
  }

  loadCurrentUser() {
    this.currentUser = {
      id: this.authService.getUserId() || 0,
      name: this.authService.getName() || 'Usuario',
      role: (this.authService.getRole() as any) || 'USER',
      user: '' 
    };
    
    this.userInitials = this.getInitials(this.currentUser.name);
    
    const id = this.authService.getUserId();
    if(id) {
        this.userService.getById(id).subscribe({
           next: (user) => { 
               this.currentUser = user; 
               this.userInitials = this.getInitials(this.currentUser.name);
           }
        });
    }
  }

  loadStudents() {
    this.loadingStudents = true;
    this.userService.getMyStudents().subscribe({
      next: (data) => {
        this.students = data;
      },
      error: (err) => console.error('Error al cargar alumnos', err),
      complete: () => {
        this.loadingStudents = false;
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  isProcessing(id: number): boolean {
    return this.processingIds.has(id);
  }

  openEscalateModal(student: User) {
    this.selectedStudent = student;
    this.durationInput = 60; // default 1h
    this.showEscalateModal = true;
  }

  closeEscalateModal() {
    this.showEscalateModal = false;
    this.selectedStudent = null;
  }

  confirmEscalate() {
    if (!this.selectedStudent) return;
    
    if (!this.durationInput || this.durationInput < 1) {
       alert('Introduzca una duración válida en minutos.');
       return;
    }

    const studentId = this.selectedStudent.id;
    this.processingIds.add(studentId);
    this.userService.escalateRoles(studentId, this.durationInput)
      .pipe(finalize(() => this.processingIds.delete(studentId)))
      .subscribe({
        next: () => {
          this.closeEscalateModal();
          this.loadStudents();
        },
        error: (err) => {
          console.error(err);
          alert('Error al intentar dar permisos temporales.');
        }
      });
  }

  deescalate(student: User) {
    this.processingIds.add(student.id);
    this.userService.deescalateRoles(student.id)
      .pipe(finalize(() => this.processingIds.delete(student.id)))
      .subscribe({
        next: () => {
          this.loadStudents();
        },
        error: (err) => {
          console.error(err);
          alert('Error al intentar revocar permisos temporales.');
        }
      });
  }
}
