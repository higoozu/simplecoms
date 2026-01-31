import { runHealthCheck } from "./health-monitor.js";

export function checkDbHealth() {
  return runHealthCheck();
}
