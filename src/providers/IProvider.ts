import type { ProjectMeta, SessionMeta, SessionDetail } from '../types.ts';

export interface IProvider {
  scanProjects(): ProjectMeta[];
  scanProject(projectId: string): SessionMeta[];
  getDetail(filePath: string): SessionDetail | null;
  deleteProject(project: ProjectMeta): void;
  deleteSession(session: SessionMeta): void;
  renameSession(session: SessionDetail, newName: string): void;
}
