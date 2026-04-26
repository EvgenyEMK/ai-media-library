import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type DesktopApi } from "../src/shared/ipc";

const api: DesktopApi = {
  selectLibraryFolder: () => ipcRenderer.invoke(IPC_CHANNELS.selectLibraryFolder),
  readFolderChildren: (folderPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.readFolderChildren, folderPath),
  pruneFolderAnalysisForMissingChildren: (parentPath, existingChildren) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.pruneFolderAnalysisForMissingChildren,
      parentPath,
      existingChildren,
    ),
  revealItemInFolder: (filePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.revealItemInFolder, filePath),
  listFolderImages: (folderPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.listFolderImages, folderPath),
  startFolderImagesStream: (folderPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.startFolderImagesStream, folderPath),
  onFolderImagesProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.folderImagesProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.folderImagesProgress, wrapped);
    };
  },
  listFolderMedia: (folderPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.listFolderMedia, folderPath),
  startFolderMediaStream: (folderPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.startFolderMediaStream, folderPath),
  onFolderMediaProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.folderMediaProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.folderMediaProgress, wrapped);
    };
  },
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  getDatabaseLocation: () => ipcRenderer.invoke(IPC_CHANNELS.getDatabaseLocation),
  getAiInferenceGpuOptions: () => ipcRenderer.invoke(IPC_CHANNELS.getAiInferenceGpuOptions),
  saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.saveSettings, settings),
  getFolderAnalysisStatuses: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getFolderAnalysisStatuses),
  getFolderAiSummaryReport: (folderPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.getFolderAiSummaryReport, folderPath),
  getFolderAiFailedFiles: (folderPath, pipeline, recursive) =>
    ipcRenderer.invoke(IPC_CHANNELS.getFolderAiFailedFiles, folderPath, pipeline, recursive),
  getFolderAiCoverage: (folderPath, recursive) =>
    ipcRenderer.invoke(IPC_CHANNELS.getFolderAiCoverage, folderPath, recursive),
  getFolderAiRollupsBatch: (folderPaths) =>
    ipcRenderer.invoke(IPC_CHANNELS.getFolderAiRollupsBatch, folderPaths),
  analyzeFolderPhotos: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.analyzeFolderPhotos, request),
  cancelPhotoAnalysis: (jobId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelPhotoAnalysis, jobId),
  onPhotoAnalysisProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.photoAnalysisProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.photoAnalysisProgress, wrapped);
    };
  },
  detectFolderFaces: (request) => ipcRenderer.invoke(IPC_CHANNELS.detectFolderFaces, request),
  cancelFaceDetection: (jobId) => ipcRenderer.invoke(IPC_CHANNELS.cancelFaceDetection, jobId),
  onFaceDetectionProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.faceDetectionProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.faceDetectionProgress, wrapped);
    };
  },
  getFaceDetectionServiceStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getFaceDetectionServiceStatus),
  indexFolderSemanticEmbeddings: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.indexFolderSemanticEmbeddings, request),
  cancelSemanticEmbeddingIndex: (jobId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelSemanticEmbeddingIndex, jobId),
  onSemanticIndexProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.semanticIndexProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.semanticIndexProgress, wrapped);
    };
  },
  onFaceModelDownloadProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.faceModelDownloadProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.faceModelDownloadProgress, wrapped);
    };
  },
  ensureDetectorModel: (detectorModel) =>
    ipcRenderer.invoke(IPC_CHANNELS.ensureDetectorModel, detectorModel),
  ensureAuxModel: (kind, modelId) =>
    ipcRenderer.invoke(IPC_CHANNELS.ensureAuxModel, kind, modelId),
  getSemanticEmbeddingStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getSemanticEmbeddingStatus),
  getSemanticIndexDebugLogTail: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getSemanticIndexDebugLogTail),
  semanticSearchPhotos: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.semanticSearchPhotos, request),
  scanFolderMetadata: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.scanFolderMetadata, request),
  cancelMetadataScan: (jobId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelMetadataScan, jobId),
  onMetadataScanProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.metadataScanProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.metadataScanProgress, wrapped);
    };
  },
  getMediaItemsByPaths: (paths) =>
    ipcRenderer.invoke(IPC_CHANNELS.getMediaItemsByPaths, paths),
  setMediaItemStarRating: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.setMediaItemStarRating, request),
  listAlbums: (request) => ipcRenderer.invoke(IPC_CHANNELS.listAlbums, request),
  createAlbum: (title) => ipcRenderer.invoke(IPC_CHANNELS.createAlbum, title),
  updateAlbumTitle: (albumId, title) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateAlbumTitle, albumId, title),
  deleteAlbum: (albumId) => ipcRenderer.invoke(IPC_CHANNELS.deleteAlbum, albumId),
  listAlbumItems: (request) => ipcRenderer.invoke(IPC_CHANNELS.listAlbumItems, request),
  listAlbumsForMediaItem: (mediaItemIdOrPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.listAlbumsForMediaItem, mediaItemIdOrPath),
  addMediaItemsToAlbum: (albumId, mediaItemIds) =>
    ipcRenderer.invoke(IPC_CHANNELS.addMediaItemsToAlbum, albumId, mediaItemIds),
  removeMediaItemFromAlbum: (albumId, mediaItemId) =>
    ipcRenderer.invoke(IPC_CHANNELS.removeMediaItemFromAlbum, albumId, mediaItemId),
  setAlbumCover: (albumId, mediaItemId) =>
    ipcRenderer.invoke(IPC_CHANNELS.setAlbumCover, albumId, mediaItemId),
  listSmartAlbumPlaces: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.listSmartAlbumPlaces, request),
  listSmartAlbumYears: () => ipcRenderer.invoke(IPC_CHANNELS.listSmartAlbumYears),
  listSmartAlbumItems: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.listSmartAlbumItems, request),
  onMediaItemMetadataRefreshed: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Record<string, import("../src/shared/ipc").DesktopMediaItemMetadata>,
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.mediaItemMetadataRefreshed, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.mediaItemMetadataRefreshed, wrapped);
    };
  },
  listPersonTags: () => ipcRenderer.invoke(IPC_CHANNELS.listPersonTags),
  listPersonTagsWithFaceCounts: () =>
    ipcRenderer.invoke(IPC_CHANNELS.listPersonTagsWithFaceCounts),
  listPersonGroups: () => ipcRenderer.invoke(IPC_CHANNELS.listPersonGroups),
  createPersonGroup: (name) => ipcRenderer.invoke(IPC_CHANNELS.createPersonGroup, name),
  setPersonTagGroups: (tagId, groupIds) =>
    ipcRenderer.invoke(IPC_CHANNELS.setPersonTagGroups, tagId, groupIds),
  getPersonTagGroupsForTagIds: (tagIds) =>
    ipcRenderer.invoke(IPC_CHANNELS.getPersonTagGroupsForTagIds, tagIds),
  updatePersonGroupName: (groupId, name) =>
    ipcRenderer.invoke(IPC_CHANNELS.updatePersonGroupName, groupId, name),
  deletePersonGroup: (groupId) =>
    ipcRenderer.invoke(IPC_CHANNELS.deletePersonGroup, groupId),
  listPersonTagsInGroup: (groupId) =>
    ipcRenderer.invoke(IPC_CHANNELS.listPersonTagsInGroup, groupId),
  getClusterPersonMatchStatsBatch: (items, threshold) =>
    ipcRenderer.invoke(IPC_CHANNELS.getClusterPersonMatchStatsBatch, { items, threshold }),
  getClusterMemberFaceIdsForPersonSimilarityFilter: (clusterId, tagId, mode, threshold) =>
    ipcRenderer.invoke(IPC_CHANNELS.getClusterMemberFaceIdsForPersonSimilarityFilter, {
      clusterId,
      tagId,
      mode,
      threshold,
    }),
  getSimilarUntaggedFaceCountsForTags: (tagIds, threshold) =>
    ipcRenderer.invoke(IPC_CHANNELS.getSimilarUntaggedFaceCountsForTags, { tagIds, threshold }),
  startSimilarUntaggedFaceCountsJob: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.startSimilarUntaggedFaceCountsJob, request),
  cancelSimilarUntaggedFaceCountsJob: (jobId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelSimilarUntaggedFaceCountsJob, jobId),
  onSimilarUntaggedCountsProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.similarUntaggedCountsProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.similarUntaggedCountsProgress, wrapped);
    };
  },
  createPersonTag: (label) => ipcRenderer.invoke(IPC_CHANNELS.createPersonTag, label),
  updatePersonTagLabel: (tagId, label) =>
    ipcRenderer.invoke(IPC_CHANNELS.updatePersonTagLabel, tagId, label),
  setPersonTagPinned: (tagId, pinned) =>
    ipcRenderer.invoke(IPC_CHANNELS.setPersonTagPinned, tagId, pinned),
  listFaceInstancesForMediaItem: (mediaItemId) =>
    ipcRenderer.invoke(IPC_CHANNELS.listFaceInstancesForMediaItem, mediaItemId),
  assignPersonTagToFace: (faceInstanceId, tagId) =>
    ipcRenderer.invoke(IPC_CHANNELS.assignPersonTagToFace, faceInstanceId, tagId),
  assignPersonTagsToFaces: (faceInstanceIds, tagId) =>
    ipcRenderer.invoke(IPC_CHANNELS.assignPersonTagsToFaces, faceInstanceIds, tagId),
  refreshPersonSuggestionsForTag: (tagId) =>
    ipcRenderer.invoke(IPC_CHANNELS.refreshPersonSuggestionsForTag, tagId),
  recomputePersonCentroid: (tagId) =>
    ipcRenderer.invoke(IPC_CHANNELS.recomputePersonCentroid, tagId),
  clearPersonTagFromFace: (faceInstanceId) =>
    ipcRenderer.invoke(IPC_CHANNELS.clearPersonTagFromFace, faceInstanceId),
  deleteFaceInstance: (faceInstanceId) =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteFaceInstance, faceInstanceId),
  detectFacesForMediaItem: (sourcePath, faceDetectionSettings) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.detectFacesForMediaItem,
      sourcePath,
      faceDetectionSettings,
    ),
  embedFolderFaces: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.embedFolderFaces, request),
  cancelFaceEmbedding: (jobId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelFaceEmbedding, jobId),
  onFaceEmbeddingProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.faceEmbeddingProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.faceEmbeddingProgress, wrapped);
    };
  },
  getEmbeddingModelStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getEmbeddingModelStatus),
  getEmbeddingStats: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getEmbeddingStats),
  searchSimilarFaces: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.searchSimilarFaces, request),
  suggestPersonTagForFace: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.suggestPersonTagForFace, request),
  findPersonMatches: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.findPersonMatches, request),
  getFaceClusters: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.getFaceClusters, request),
  listClusterFaceIds: (clusterId, options) =>
    ipcRenderer.invoke(IPC_CHANNELS.listClusterFaceIds, clusterId, options),
  runFaceClustering: (options) =>
    ipcRenderer.invoke(IPC_CHANNELS.runFaceClustering, options),
  cancelFaceClustering: (jobId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelFaceClustering, jobId),
  onFaceClusteringProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.faceClusteringProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.faceClusteringProgress, wrapped);
    };
  },
  assignClusterToPerson: (clusterId, tagId) =>
    ipcRenderer.invoke(IPC_CHANNELS.assignClusterToPerson, clusterId, tagId),
  suggestPersonTagForCluster: (clusterId, threshold) =>
    ipcRenderer.invoke(IPC_CHANNELS.suggestPersonTagForCluster, clusterId, threshold),
  suggestPersonTagsForClusters: (clusterIds, threshold) =>
    ipcRenderer.invoke(IPC_CHANNELS.suggestPersonTagsForClusters, clusterIds, threshold),
  getFaceCropPaths: (faceInstanceIds) =>
    ipcRenderer.invoke(IPC_CHANNELS.getFaceCropPaths, faceInstanceIds),
  listFacesForPerson: (tagId) =>
    ipcRenderer.invoke(IPC_CHANNELS.listFacesForPerson, tagId),
  getFaceInfoByIds: (faceInstanceIds) =>
    ipcRenderer.invoke(IPC_CHANNELS.getFaceInfoByIds, faceInstanceIds),
  getFaceToPersonCentroidSimilarities: (faceInstanceIds, tagId) =>
    ipcRenderer.invoke(IPC_CHANNELS.getFaceToPersonCentroidSimilarities, faceInstanceIds, tagId),
  refreshPersonSuggestions: () =>
    ipcRenderer.invoke(IPC_CHANNELS.refreshPersonSuggestions),
  reprocessFaceCropsAndEmbeddings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.reprocessFaceCropsAndEmbeddings),
  purgeDeletedMediaItems: () =>
    ipcRenderer.invoke(IPC_CHANNELS.purgeDeletedMediaItems),
  purgeSoftDeletedMediaItemsByIds: (mediaItemIds: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.purgeSoftDeletedMediaItemsByIds, mediaItemIds),
  getActiveJobStatuses: () => ipcRenderer.invoke(IPC_CHANNELS.getActiveJobStatuses),
  analyzeFolderPathMetadata: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.analyzeFolderPathMetadata, request),
  cancelPathAnalysis: (jobId) => ipcRenderer.invoke(IPC_CHANNELS.cancelPathAnalysis, jobId),
  onPathAnalysisProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.pathAnalysisProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.pathAnalysisProgress, wrapped);
    };
  },
  getGeocoderCacheStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getGeocoderCacheStatus),
  initGeocoder: (options) => ipcRenderer.invoke(IPC_CHANNELS.initGeocoder, options),
  onGeocoderInitProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.geocoderInitProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.geocoderInitProgress, wrapped);
    };
  },
  // TEMPORARY: description embedding backfill — remove after migration
  indexDescriptionEmbeddings: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.indexDescriptionEmbeddings, request),
  cancelDescEmbedBackfill: (jobId) =>
    ipcRenderer.invoke(IPC_CHANNELS.cancelDescEmbedBackfill, jobId),
  onDescEmbedBackfillProgress: (listener) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof listener>[0],
    ) => {
      listener(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.descEmbedBackfillProgress, wrapped);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.descEmbedBackfillProgress, wrapped);
    };
  },
  _logToMain: (msg: string) => ipcRenderer.send("renderer:log", msg),
};

contextBridge.exposeInMainWorld("desktopApi", api);
