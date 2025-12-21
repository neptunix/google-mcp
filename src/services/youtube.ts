import { google, type youtube_v3, type Auth } from "googleapis";

export interface YouTubeVideo {
  id: string;
  title: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  thumbnails?: {
    default?: { url: string; width?: number; height?: number };
    medium?: { url: string; width?: number; height?: number };
    high?: { url: string; width?: number; height?: number };
  };
  tags?: string[];
  duration?: string;
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  url: string;
}

export interface YouTubeChannel {
  id: string;
  title: string;
  description?: string;
  customUrl?: string;
  publishedAt?: string;
  thumbnails?: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
  url: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  thumbnails?: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
  itemCount?: number;
  url: string;
}

export interface YouTubePlaylistItem {
  id: string;
  videoId: string;
  title: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  position?: number;
  publishedAt?: string;
  thumbnails?: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
}

export interface YouTubeComment {
  id: string;
  authorDisplayName: string;
  authorProfileImageUrl?: string;
  authorChannelUrl?: string;
  textDisplay: string;
  likeCount?: number;
  publishedAt?: string;
  updatedAt?: string;
}

export class YouTubeService {
  private readonly youtube: youtube_v3.Youtube;

  constructor(authClient: Auth.OAuth2Client) {
    this.youtube = google.youtube({ version: "v3", auth: authClient });
  }

  // Search

  public async search(options: {
    query: string;
    type?: "video" | "channel" | "playlist";
    maxResults?: number;
    pageToken?: string;
    order?: "date" | "rating" | "relevance" | "title" | "viewCount";
    publishedAfter?: string;
    publishedBefore?: string;
    channelId?: string;
  }): Promise<{
    items: Array<YouTubeVideo | YouTubeChannel | YouTubePlaylist>;
    nextPageToken?: string;
  }> {
    const response = await this.youtube.search.list({
      part: ["snippet"],
      q: options.query,
      type: options.type ? [options.type] : ["video"],
      maxResults: options.maxResults || 25,
      pageToken: options.pageToken,
      order: options.order || "relevance",
      publishedAfter: options.publishedAfter,
      publishedBefore: options.publishedBefore,
      channelId: options.channelId,
    });

    const items: Array<YouTubeVideo | YouTubeChannel | YouTubePlaylist> = [];

    for (const item of response.data.items || []) {
      if (item.id?.videoId) {
        items.push({
          id: item.id.videoId,
          title: item.snippet?.title || "",
          description: item.snippet?.description || undefined,
          channelId: item.snippet?.channelId || undefined,
          channelTitle: item.snippet?.channelTitle || undefined,
          publishedAt: item.snippet?.publishedAt || undefined,
          thumbnails: item.snippet?.thumbnails as YouTubeVideo["thumbnails"],
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        });
      } else if (item.id?.channelId) {
        items.push({
          id: item.id.channelId,
          title: item.snippet?.title || "",
          description: item.snippet?.description || undefined,
          publishedAt: item.snippet?.publishedAt || undefined,
          thumbnails: item.snippet?.thumbnails as YouTubeChannel["thumbnails"],
          url: `https://www.youtube.com/channel/${item.id.channelId}`,
        });
      } else if (item.id?.playlistId) {
        items.push({
          id: item.id.playlistId,
          title: item.snippet?.title || "",
          description: item.snippet?.description || undefined,
          channelId: item.snippet?.channelId || undefined,
          channelTitle: item.snippet?.channelTitle || undefined,
          publishedAt: item.snippet?.publishedAt || undefined,
          thumbnails: item.snippet?.thumbnails as YouTubePlaylist["thumbnails"],
          url: `https://www.youtube.com/playlist?list=${item.id.playlistId}`,
        });
      }
    }

    return {
      items,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  // Videos

  public async getVideo(videoId: string): Promise<YouTubeVideo> {
    const response = await this.youtube.videos.list({
      part: ["snippet", "contentDetails", "statistics"],
      id: [videoId],
    });

    const video = response.data.items?.[0];
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    return {
      id: video.id || "",
      title: video.snippet?.title || "",
      description: video.snippet?.description || undefined,
      channelId: video.snippet?.channelId || undefined,
      channelTitle: video.snippet?.channelTitle || undefined,
      publishedAt: video.snippet?.publishedAt || undefined,
      thumbnails: video.snippet?.thumbnails as YouTubeVideo["thumbnails"],
      tags: video.snippet?.tags || undefined,
      duration: video.contentDetails?.duration || undefined,
      viewCount: video.statistics?.viewCount || undefined,
      likeCount: video.statistics?.likeCount || undefined,
      commentCount: video.statistics?.commentCount || undefined,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    };
  }

  public async getVideos(videoIds: string[]): Promise<YouTubeVideo[]> {
    const response = await this.youtube.videos.list({
      part: ["snippet", "contentDetails", "statistics"],
      id: videoIds,
    });

    return (response.data.items || []).map((video) => ({
      id: video.id || "",
      title: video.snippet?.title || "",
      description: video.snippet?.description || undefined,
      channelId: video.snippet?.channelId || undefined,
      channelTitle: video.snippet?.channelTitle || undefined,
      publishedAt: video.snippet?.publishedAt || undefined,
      thumbnails: video.snippet?.thumbnails as YouTubeVideo["thumbnails"],
      tags: video.snippet?.tags || undefined,
      duration: video.contentDetails?.duration || undefined,
      viewCount: video.statistics?.viewCount || undefined,
      likeCount: video.statistics?.likeCount || undefined,
      commentCount: video.statistics?.commentCount || undefined,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    }));
  }

  // Channels

  public async getChannel(channelId: string): Promise<YouTubeChannel> {
    const response = await this.youtube.channels.list({
      part: ["snippet", "statistics"],
      id: [channelId],
    });

    const channel = response.data.items?.[0];
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    return {
      id: channel.id || "",
      title: channel.snippet?.title || "",
      description: channel.snippet?.description || undefined,
      customUrl: channel.snippet?.customUrl || undefined,
      publishedAt: channel.snippet?.publishedAt || undefined,
      thumbnails: channel.snippet?.thumbnails as YouTubeChannel["thumbnails"],
      subscriberCount: channel.statistics?.subscriberCount || undefined,
      videoCount: channel.statistics?.videoCount || undefined,
      viewCount: channel.statistics?.viewCount || undefined,
      url: channel.snippet?.customUrl
        ? `https://www.youtube.com/${channel.snippet.customUrl}`
        : `https://www.youtube.com/channel/${channel.id}`,
    };
  }

  public async getMyChannel(): Promise<YouTubeChannel> {
    const response = await this.youtube.channels.list({
      part: ["snippet", "statistics"],
      mine: true,
    });

    const channel = response.data.items?.[0];
    if (!channel) {
      throw new Error("No channel found for authenticated user");
    }

    return {
      id: channel.id || "",
      title: channel.snippet?.title || "",
      description: channel.snippet?.description || undefined,
      customUrl: channel.snippet?.customUrl || undefined,
      publishedAt: channel.snippet?.publishedAt || undefined,
      thumbnails: channel.snippet?.thumbnails as YouTubeChannel["thumbnails"],
      subscriberCount: channel.statistics?.subscriberCount || undefined,
      videoCount: channel.statistics?.videoCount || undefined,
      viewCount: channel.statistics?.viewCount || undefined,
      url: channel.snippet?.customUrl
        ? `https://www.youtube.com/${channel.snippet.customUrl}`
        : `https://www.youtube.com/channel/${channel.id}`,
    };
  }

  // Playlists

  public async listMyPlaylists(options: {
    maxResults?: number;
    pageToken?: string;
  } = {}): Promise<{ playlists: YouTubePlaylist[]; nextPageToken?: string }> {
    const response = await this.youtube.playlists.list({
      part: ["snippet", "contentDetails"],
      mine: true,
      maxResults: options.maxResults || 25,
      pageToken: options.pageToken,
    });

    const playlists: YouTubePlaylist[] = (response.data.items || []).map((pl) => ({
      id: pl.id || "",
      title: pl.snippet?.title || "",
      description: pl.snippet?.description || undefined,
      channelId: pl.snippet?.channelId || undefined,
      channelTitle: pl.snippet?.channelTitle || undefined,
      publishedAt: pl.snippet?.publishedAt || undefined,
      thumbnails: pl.snippet?.thumbnails as YouTubePlaylist["thumbnails"],
      itemCount: pl.contentDetails?.itemCount || undefined,
      url: `https://www.youtube.com/playlist?list=${pl.id}`,
    }));

    return {
      playlists,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  public async getPlaylist(playlistId: string): Promise<YouTubePlaylist> {
    const response = await this.youtube.playlists.list({
      part: ["snippet", "contentDetails"],
      id: [playlistId],
    });

    const playlist = response.data.items?.[0];
    if (!playlist) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }

    return {
      id: playlist.id || "",
      title: playlist.snippet?.title || "",
      description: playlist.snippet?.description || undefined,
      channelId: playlist.snippet?.channelId || undefined,
      channelTitle: playlist.snippet?.channelTitle || undefined,
      publishedAt: playlist.snippet?.publishedAt || undefined,
      thumbnails: playlist.snippet?.thumbnails as YouTubePlaylist["thumbnails"],
      itemCount: playlist.contentDetails?.itemCount || undefined,
      url: `https://www.youtube.com/playlist?list=${playlist.id}`,
    };
  }

  public async getPlaylistItems(
    playlistId: string,
    options: { maxResults?: number; pageToken?: string } = {}
  ): Promise<{ items: YouTubePlaylistItem[]; nextPageToken?: string }> {
    const response = await this.youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId,
      maxResults: options.maxResults || 50,
      pageToken: options.pageToken,
    });

    const items: YouTubePlaylistItem[] = (response.data.items || []).map((item) => ({
      id: item.id || "",
      videoId: item.contentDetails?.videoId || "",
      title: item.snippet?.title || "",
      description: item.snippet?.description || undefined,
      channelId: item.snippet?.channelId || undefined,
      channelTitle: item.snippet?.channelTitle || undefined,
      position: item.snippet?.position || undefined,
      publishedAt: item.snippet?.publishedAt || undefined,
      thumbnails: item.snippet?.thumbnails as YouTubePlaylistItem["thumbnails"],
    }));

    return {
      items,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  // Comments

  public async getVideoComments(
    videoId: string,
    options: {
      maxResults?: number;
      pageToken?: string;
      order?: "time" | "relevance";
    } = {}
  ): Promise<{ comments: YouTubeComment[]; nextPageToken?: string }> {
    const response = await this.youtube.commentThreads.list({
      part: ["snippet"],
      videoId,
      maxResults: options.maxResults || 20,
      pageToken: options.pageToken,
      order: options.order || "relevance",
    });

    const comments: YouTubeComment[] = (response.data.items || []).map((item) => {
      const comment = item.snippet?.topLevelComment?.snippet;
      return {
        id: item.id || "",
        authorDisplayName: comment?.authorDisplayName || "",
        authorProfileImageUrl: comment?.authorProfileImageUrl || undefined,
        authorChannelUrl: comment?.authorChannelUrl || undefined,
        textDisplay: comment?.textDisplay || "",
        likeCount: comment?.likeCount || undefined,
        publishedAt: comment?.publishedAt || undefined,
        updatedAt: comment?.updatedAt || undefined,
      };
    });

    return {
      comments,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  // Subscriptions

  public async listMySubscriptions(options: {
    maxResults?: number;
    pageToken?: string;
  } = {}): Promise<{ channels: YouTubeChannel[]; nextPageToken?: string }> {
    const response = await this.youtube.subscriptions.list({
      part: ["snippet"],
      mine: true,
      maxResults: options.maxResults || 50,
      pageToken: options.pageToken,
    });

    const channels: YouTubeChannel[] = (response.data.items || []).map((sub) => ({
      id: sub.snippet?.resourceId?.channelId || "",
      title: sub.snippet?.title || "",
      description: sub.snippet?.description || undefined,
      thumbnails: sub.snippet?.thumbnails as YouTubeChannel["thumbnails"],
      url: `https://www.youtube.com/channel/${sub.snippet?.resourceId?.channelId}`,
    }));

    return {
      channels,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  // Liked Videos

  public async listLikedVideos(options: {
    maxResults?: number;
    pageToken?: string;
  } = {}): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string }> {
    const response = await this.youtube.videos.list({
      part: ["snippet", "contentDetails", "statistics"],
      myRating: "like",
      maxResults: options.maxResults || 25,
      pageToken: options.pageToken,
    });

    const videos: YouTubeVideo[] = (response.data.items || []).map((video) => ({
      id: video.id || "",
      title: video.snippet?.title || "",
      description: video.snippet?.description || undefined,
      channelId: video.snippet?.channelId || undefined,
      channelTitle: video.snippet?.channelTitle || undefined,
      publishedAt: video.snippet?.publishedAt || undefined,
      thumbnails: video.snippet?.thumbnails as YouTubeVideo["thumbnails"],
      tags: video.snippet?.tags || undefined,
      duration: video.contentDetails?.duration || undefined,
      viewCount: video.statistics?.viewCount || undefined,
      likeCount: video.statistics?.likeCount || undefined,
      commentCount: video.statistics?.commentCount || undefined,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    }));

    return {
      videos,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  // Rate Video

  public async rateVideo(videoId: string, rating: "like" | "dislike" | "none"): Promise<void> {
    await this.youtube.videos.rate({
      id: videoId,
      rating,
    });
  }

  // Captions

  public async listCaptions(videoId: string): Promise<
    Array<{
      id: string;
      language: string;
      name: string;
      trackKind: string;
    }>
  > {
    const response = await this.youtube.captions.list({
      part: ["snippet"],
      videoId,
    });

    return (response.data.items || []).map((caption) => ({
      id: caption.id || "",
      language: caption.snippet?.language || "",
      name: caption.snippet?.name || "",
      trackKind: caption.snippet?.trackKind || "",
    }));
  }
}

