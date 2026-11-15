export type MicAccess = PermissionState | 'unknown';

export const queryMicPermission = async (): Promise<MicAccess> => {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' } as unknown as PermissionDescriptor);
    return status.state;
  } catch {
    return 'unknown';
  }
};
