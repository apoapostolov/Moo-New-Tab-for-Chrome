export const DRIVE_VIEWS = ['recent', 'starred', 'shared'];
export const readDriveView = () => {
  const stored = localStorage.getItem('googleDriveView');
  return DRIVE_VIEWS.includes(stored) ? stored : 'recent';
};
export const drivePageSize = (value) => Math.max(5, Math.min(30, Math.floor(Number(value)) || 10));
export const readDrivePageSize = () => drivePageSize(localStorage.getItem('googleDriveMax'));
export const atDriveBottom = (node) => node.scrollTop + node.clientHeight >= node.scrollHeight - 8;
