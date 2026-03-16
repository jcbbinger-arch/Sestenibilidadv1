export interface TaskPart {
  id: string;
  title: string;
  content: string[];
}

export interface Task {
  id: string;
  title: string;
  parts: TaskPart[];
}

export const tasks: Task[] = [
  {
    id: 'tarea-1',
    title: 'Tarea 1: Constitución y Roles',
    parts: [
      {
        id: '1a',
        title: 'A. Parte Individual (El "Compromiso de Firma")',
        content: [
          'Elección de Rol: Cada alumno debe leer las 5 descripciones y enviar al grupo (vía WhatsApp/Drive) cuál prefiere y por qué, aportando una "Responsabilidad adicional" personalizada según su perfil (ej. el de Producción puede proponer: "Me encargaré de verificar que los alérgenos estén marcados").',
          'Firma Digital/Escaneada: Cada uno debe enviar su firma individual en formato imagen o PDF para que el Secretario pueda insertarla en el documento final. Así, si un alumno no envía su firma, se evidencia quién no se ha comprometido desde el día uno.'
        ]
      },
      {
        id: '1b',
        title: 'B. Parte Grupal (El "Mueble de IKEA" del Equipo)',
        content: [
          'El "Documento Semilla": El Secretario crea un documento compartido (Google Docs o Word Online).',
          'Volcado de Datos: Cada miembro entra en su tiempo libre y rellena su apartado (Nombre y su responsabilidad adicional).',
          'La "Puesta en Común" de 10 minutos: El Coordinador convoca una videollamada corta o un chat rápido para decidir los tres datos clave que dan identidad al grupo: Nombre del equipo, Nombre del proyecto (un nombre sugerente de restaurante), Zona de la Región de Murcia elegida.',
          'Consolidación: El Portavoz revisa que los nombres de sus compañeros y la zona elegida estén bien escritos antes de subirlo al aula virtual.'
        ]
      }
    ]
  }
];
