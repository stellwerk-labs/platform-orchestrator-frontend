export const getDeploymentStatus = (deploymentStatus: string): string => {
  let status = '';
  switch (deploymentStatus) {
    case 'never deployed':
      status = 'Never deployed';
      break;
    case 'failed':
      status = 'Failed';
      break;
    case 'timeout':
      status = 'Timed out';
      break;
    case 'succeeded':
      status = 'Successful';
      break;
    case 'in progress':
      status = 'Deploying';
      break;
    case 'cluster_changed':
      status = 'Cluster changed';
      break;
    default:
      break;
  }
  return status;
};
