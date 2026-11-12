// Vite turns `?worker` imports into Worker constructors.
declare module '*?worker' {
  const WorkerFactory: new () => Worker
  export default WorkerFactory
}
