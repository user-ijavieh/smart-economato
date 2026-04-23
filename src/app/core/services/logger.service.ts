import { Injectable } from '@angular/core';  
import { environment } from '../../../environments/environment';  
  
@Injectable({ providedIn: 'root' })  
export class LoggerService {  
  
  warn(message: string, ...args: any[]): void {  
    if (!environment.production) {  
      console.warn(message, ...args);  
    }  
  }  
  
  error(message: string, ...args: any[]): void {  
    // Los errores siempre se muestran, incluso en producción  
    console.error(message, ...args);  
  }  
}
