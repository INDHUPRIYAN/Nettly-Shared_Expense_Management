export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  myGroups: () => ['my-groups'] as const,
  group: (groupId: string) => ['group', groupId] as const,
  invite: (token: string) => ['invite', token] as const,
}
