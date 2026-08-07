import { NextResponse } from 'next/server'

// Public, non-secret runtime contract consumed by extension v1.5+.
// Keeping volatile policy and Facebook operation ids here lets us repair most
// upstream changes without publishing a new Chrome Web Store package.
const runtime = {
  protocolVersion: 1,
  revision: '2026-08-07.1',
  minExtensionVersion: '1.5.0',
  cacheTtlSec: 6 * 60 * 60,
  defaults: {
    dailyCap: 30,
    minDelaySec: 90,
    maxDelaySec: 240,
    minScore: 60,
    postsPerScan: 5,
    maxPostAgeHours: 72,
  },
  safety: {
    minCommentDelaySec: 90,
    minJoinDelaySec: 20,
    maxConsecutiveErrors: 3,
    maxGroupsPerAutoScan: 5,
  },
  facebookOperations: {
    joinedGroups: { friendlyName: 'GroupsLeftRailYourGroupsPaginatedQuery', docId: '9658982227546884' },
    groupFeed: { friendlyName: 'GroupsCometFeedRegularStoriesPaginationQuery', docId: '27211790165108232' },
    comment: { friendlyName: 'useCometUFICreateCommentMutation', docId: '27279862301707853' },
    groupSearch: { friendlyName: 'SearchCometResultsPaginatedResultsQuery', docId: '27332614923056014' },
    joinGroup: { friendlyName: 'GroupCometJoinForumMutation', docId: '27095583533431012' },
    createPost: { friendlyName: 'ComposerStoryCreateMutation', docId: '27450471367978057' },
    videoConfig: { friendlyName: 'MediaUploadFBDefaultServerConfigurationRetrieverQuery', docId: '26396735533340887' },
    pageSearch: { friendlyName: 'SearchCometResultsPaginatedResultsQuery', docId: '27547223741556484' },
    pageFeed: { friendlyName: 'ProfileCometTimelineFeedRefetchQuery', docId: '27394782800205609' },
    postComments: { friendlyName: 'CommentsListComponentsPaginationQuery', docId: '28148854324717105' },
    hideComment: { friendlyName: 'CometUFIHideCommentMutation', docId: '27488296064098098' },
    leaveGroup: { friendlyName: 'GroupCometLeaveForumMutation', docId: '27087223784277669' },
    activityLog: { friendlyName: 'CometActivityLogStoriesListPaginationQuery', docId: '27478633398483911' },
  },
} as const

export async function GET() {
  return NextResponse.json(runtime, {
    headers: {
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  })
}
