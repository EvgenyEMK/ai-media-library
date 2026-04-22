import type { ReactElement } from "react";
import type { AnalysisEtaState, FaceEtaState, MetadataProgressState, SemanticIndexEtaState } from "../../hooks/use-eta-tracking";
import type { DescEmbedBackfillState } from "./types";
import type { DesktopProgressDockModel } from "./use-desktop-progress-dock-state";
import { AnalysisCard } from "./cards/AnalysisCard";
import { DescEmbedBackfillCard } from "./cards/DescEmbedBackfillCard";
import { FaceClusteringCard } from "./cards/FaceClusteringCard";
import { FaceDetectionCard } from "./cards/FaceDetectionCard";
import { GeocoderInitCard } from "./cards/GeocoderInitCard";
import { MetadataScanCard } from "./cards/MetadataScanCard";
import { PathAnalysisCard } from "./cards/PathAnalysisCard";
import { SemanticIndexCard } from "./cards/SemanticIndexCard";
import { SimilarUntaggedCountsCard } from "./cards/SimilarUntaggedCountsCard";

interface ProgressDockCardsProps {
  dock: DesktopProgressDockModel;
  analysisEta: AnalysisEtaState;
  faceEta: FaceEtaState;
  metadataProgress: MetadataProgressState;
  semanticIndexEta: SemanticIndexEtaState;
  onCancelMetadataScan: () => void;
  onCancelAnalysis: () => void;
  onCancelFaceDetection: () => void;
  onCancelSemanticIndex: () => void;
  onCancelFaceClustering: () => void;
  onCancelSimilarUntaggedFaceCounts: () => void;
  onCancelPathAnalysis: () => void;
  descEmbedBackfill?: DescEmbedBackfillState;
  onCancelDescEmbedBackfill?: () => void;
  onDismissDescEmbedBackfill?: () => void;
}

export function ProgressDockCards({
  dock: d,
  analysisEta,
  faceEta,
  metadataProgress,
  semanticIndexEta,
  onCancelMetadataScan,
  onCancelAnalysis,
  onCancelFaceDetection,
  onCancelSemanticIndex,
  onCancelFaceClustering,
  onCancelSimilarUntaggedFaceCounts,
  onCancelPathAnalysis,
  descEmbedBackfill,
  onCancelDescEmbedBackfill,
  onDismissDescEmbedBackfill,
}: ProgressDockCardsProps): ReactElement {
  const store = d.store;

  return (
    <>
      {d.metadataQualifies ? (
        <MetadataScanCard
          store={store}
          metadataProgress={metadataProgress}
          metadataPhase={d.metadataPhase}
          metadataPhaseProcessed={d.metadataPhaseProcessed}
          metadataPhaseTotal={d.metadataPhaseTotal}
          isMetadataScanning={d.isMetadataScanning}
          metadataJobId={d.metadataJobId}
          onCancelMetadataScan={onCancelMetadataScan}
        />
      ) : null}

      {d.aiQualifies ? (
        <AnalysisCard
          store={store}
          analysisEta={analysisEta}
          isAnalyzing={d.isAnalyzing}
          aiJobId={d.aiJobId}
          aiError={d.aiError}
          aiCurrentFolderPath={d.aiCurrentFolderPath}
          aiPhase={d.aiPhase}
          onCancelAnalysis={onCancelAnalysis}
        />
      ) : null}

      {d.faceQualifies ? (
        <FaceDetectionCard
          store={store}
          faceEta={faceEta}
          isDetectingFaces={d.isDetectingFaces}
          faceJobId={d.faceJobId}
          faceError={d.faceError}
          faceCurrentFolderPath={d.faceCurrentFolderPath}
          faceServiceStatus={d.faceServiceStatus}
          onCancelFaceDetection={onCancelFaceDetection}
        />
      ) : null}

      {d.faceClusteringQualifies ? (
        <FaceClusteringCard
          store={store}
          isFaceClusteringRunning={d.isFaceClusteringRunning}
          faceClusteringJobId={d.faceClusteringJobId}
          faceClusteringError={d.faceClusteringError}
          faceClusteringPhase={d.faceClusteringPhase}
          faceClusteringProcessed={d.faceClusteringProcessed}
          faceClusteringTotal={d.faceClusteringTotal}
          faceClusteringProgressPercent={d.faceClusteringProgressPercent}
          faceClusteringClusterCount={d.faceClusteringClusterCount}
          faceClusteringTotalFaces={d.faceClusteringTotalFaces}
          faceClusteringStatus={d.faceClusteringStatus}
          faceClusteringPhaseLabel={d.faceClusteringPhaseLabel}
          onCancelFaceClustering={onCancelFaceClustering}
        />
      ) : null}

      {d.semanticQualifies ? (
        <SemanticIndexCard
          store={store}
          semanticIndexEta={semanticIndexEta}
          isSemanticIndexing={d.isSemanticIndexing}
          semanticIndexJobId={d.semanticIndexJobId}
          semanticIndexError={d.semanticIndexError}
          semanticIndexCurrentFolderPath={d.semanticIndexCurrentFolderPath}
          semanticIndexPhase={d.semanticIndexPhase}
          onCancelSemanticIndex={onCancelSemanticIndex}
        />
      ) : null}

      {d.pathAnalysisQualifies ? (
        <PathAnalysisCard
          store={store}
          isPathAnalysisRunning={d.isPathAnalysisRunning}
          pathAnalysisJobId={d.pathAnalysisJobId}
          pathAnalysisProcessed={d.pathAnalysisProcessed}
          pathAnalysisTotal={d.pathAnalysisTotal}
          pathAnalysisFolderPath={d.pathAnalysisFolderPath}
          pathAnalysisError={d.pathAnalysisError}
          onCancelPathAnalysis={onCancelPathAnalysis}
        />
      ) : null}

      {d.similarUntaggedCountsQualifies ? (
        <SimilarUntaggedCountsCard
          store={store}
          isSimilarUntaggedCountsRunning={d.isSimilarUntaggedCountsRunning}
          similarUntaggedCountsJobId={d.similarUntaggedCountsJobId}
          similarUntaggedCountsProgressPercent={d.similarUntaggedCountsProgressPercent}
          similarUntaggedCountsProcessed={d.similarUntaggedCountsProcessed}
          similarUntaggedCountsTotal={d.similarUntaggedCountsTotal}
          similarUntaggedCountsStatus={d.similarUntaggedCountsStatus}
          similarUntaggedCountsError={d.similarUntaggedCountsError}
          onCancelSimilarUntaggedFaceCounts={onCancelSimilarUntaggedFaceCounts}
        />
      ) : null}

      {d.geocoderQualifies ? (
        <GeocoderInitCard
          store={store}
          isGeocoderInitRunning={d.isGeocoderInitRunning}
          geocoderInitStatus={d.geocoderInitStatus}
          geocoderInitError={d.geocoderInitError}
        />
      ) : null}

      {d.descEmbedQualifies && descEmbedBackfill ? (
        <DescEmbedBackfillCard
          descEmbedBackfill={descEmbedBackfill}
          descEmbedRunning={d.descEmbedRunning}
          descEmbedProgressPercent={d.descEmbedProgressPercent}
          onCancelDescEmbedBackfill={onCancelDescEmbedBackfill}
          onDismissDescEmbedBackfill={onDismissDescEmbedBackfill}
        />
      ) : null}
    </>
  );
}
