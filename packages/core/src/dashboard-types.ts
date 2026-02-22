export interface DashboardOverview {
  summary: {
    specifications: number
    requirements: number
    activeChanges: number
    inProgressChanges: number
    completedChanges: number
    tasksTotal: number
    tasksCompleted: number
  }
  specifications: Array<{
    id: string
    name: string
    requirements: number
    updatedAt: number
  }>
  activeChanges: Array<{
    id: string
    name: string
    progress: { total: number; completed: number }
    updatedAt: number
  }>
}
