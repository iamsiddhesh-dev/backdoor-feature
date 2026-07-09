// CAPTURE layer. This screen's only job is to produce a video file and hand
// it to processVideo(). It must not know anything about transcription or
// extraction — that logic lives entirely behind the processVideo() seam so a
// future WhatsApp-based capture layer can call the exact same function.

import { useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { processVideo, confirmAdditions } from "./processVideo";

const MAX_DURATION_SECONDS = 60;
const PROMPT_TEXT =
  "Tell us who you are, what you've built, and why you want to work at an early-stage startup.";

// Screen states: "idle" -> "recording" -> "preview" -> "processing" -> "done"
export default function CameraScreen() {
  const [screenState, setScreenState] = useState("idle");
  const [videoUri, setVideoUri] = useState(null);
  const [result, setResult] = useState(null);
  const [checkedAdditions, setCheckedAdditions] = useState(new Set());
  const [confirmState, setConfirmState] = useState("idle"); // idle | confirming | confirmed

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();

  const permissionsReady =
    cameraPermission?.granted && micPermission?.granted;

  async function ensurePermissions() {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) return false;
    }
    if (!micPermission?.granted) {
      const res = await requestMicPermission();
      if (!res.granted) return false;
    }
    return true;
  }

  async function handleStartRecording() {
    const ok = await ensurePermissions();
    if (!ok) {
      Alert.alert(
        "Permissions needed",
        "Camera and microphone access are required to record your intro video."
      );
      return;
    }
    if (!cameraRef.current) return;

    setScreenState("recording");
    try {
      // maxDuration enforces the hard 60s cap; recordAsync resolves once
      // recording stops, either by hitting that cap or handleStopRecording().
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION_SECONDS,
      });
      setVideoUri(video.uri);
      setScreenState("preview");
    } catch (err) {
      console.error("Recording failed:", err);
      Alert.alert("Recording failed", String(err?.message ?? err));
      setScreenState("idle");
    }
  }

  function handleStopRecording() {
    cameraRef.current?.stopRecording();
  }

  function handleRetake() {
    setVideoUri(null);
    setResult(null);
    setCheckedAdditions(new Set());
    setConfirmState("idle");
    setScreenState("idle");
  }

  function toggleAddition(index) {
    setCheckedAdditions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setConfirmState("idle"); // selection changed since last confirm
  }

  async function handleConfirmAdditions() {
    const additions = result?.extraction?.resume_additions ?? [];
    const confirmed = additions.filter((_, i) => checkedAdditions.has(i));

    setConfirmState("confirming");
    try {
      await confirmAdditions(result.sessionId, confirmed);
    } catch (err) {
      // Demo-grade: this is a fire-and-forget record of the candidate's
      // choice, not a blocking step, so a backend hiccup (e.g. the in-memory
      // session having been cleared by a server restart) shouldn't stop the
      // candidate from finishing their flow — just log it for us to debug.
      console.error("confirmAdditions failed:", err);
    }

    // The founder review link is operator/backend info (logged server-side),
    // never surfaced to the candidate here — confirming always just succeeds.
    setConfirmState("confirmed");
  }

  async function handleUseVideo() {
    setScreenState("processing");
    try {
      // Hand off to the processing layer. The camera screen doesn't know or
      // care whether this ends up calling a local stub or a real backend.
      const extraction = await processVideo(videoUri);
      setResult(extraction);
      // Resume additions are opt-out: default every stated fact to checked.
      const additionsCount = extraction.extraction?.resume_additions?.length ?? 0;
      setCheckedAdditions(new Set(Array.from({ length: additionsCount }, (_, i) => i)));
      setScreenState("done");
    } catch (err) {
      console.error("processVideo failed:", err);
      Alert.alert("Processing failed", String(err?.message ?? err));
      setScreenState("preview");
    }
  }

  if (!cameraPermission || !micPermission) {
    return <View style={styles.container} />;
  }

  if (!permissionsReady) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.promptDark}>
          Camera and microphone permissions are required.
        </Text>
        <Pressable style={styles.button} onPress={ensurePermissions}>
          <Text style={styles.buttonText}>Grant permissions</Text>
        </Pressable>
      </View>
    );
  }

  if (screenState === "preview" && videoUri) {
    return (
      <View style={styles.container}>
        <VideoPreview uri={videoUri} />
        <View style={[styles.row, { paddingBottom: 16 + insets.bottom }]}>
          <Pressable style={styles.buttonOutline} onPress={handleRetake}>
            <Text style={styles.buttonOutlineText}>Retake</Text>
          </Pressable>
          <Pressable style={styles.buttonPrimary} onPress={handleUseVideo}>
            <Text style={styles.buttonText}>Use this video</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (screenState === "processing") {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.promptDark}>Uploading & processing your video…</Text>
      </View>
    );
  }

  if (screenState === "done" && result) {
    const additions = result.extraction?.resume_additions ?? [];
    return (
      <View style={[styles.container, styles.resultContainer]}>
        {confirmState === "confirmed" && (
          <Pressable
            style={[styles.closeButton, { top: insets.top + 12 }]}
            onPress={handleRetake}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        )}
        <ScrollView style={styles.transcriptScroll} contentContainerStyle={{ paddingBottom: 8 }}>
          <Text style={styles.heading}>Add to your resume</Text>
          {additions.length === 0 ? (
            <Text style={styles.emptyStateText}>
              No new resume-worthy facts were found in your video.
            </Text>
          ) : (
            additions.map((item, index) => {
              const checked = checkedAdditions.has(index);
              return (
                <Pressable
                  key={index}
                  style={styles.checklistRow}
                  onPress={() => toggleAddition(index)}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checklistText}>{item}</Text>
                </Pressable>
              );
            })
          )}

          {additions.length > 0 && (
            <Pressable
              style={[
                styles.confirmButton,
                confirmState === "confirmed" && styles.confirmButtonDone,
              ]}
              disabled={confirmState !== "idle"}
              onPress={handleConfirmAdditions}
            >
              <Text style={styles.buttonText}>
                {confirmState === "confirming"
                  ? "Confirming…"
                  : confirmState === "confirmed"
                  ? "Confirmed ✓"
                  : `Confirm selections (${checkedAdditions.size})`}
              </Text>
            </Pressable>
          )}

          <Text style={[styles.heading, styles.transcriptHeading]}>Transcript</Text>
          <Text style={styles.transcriptText}>{result.transcript?.text}</Text>
        </ScrollView>
        <Pressable
          style={[styles.button, { marginBottom: insets.bottom }]}
          onPress={handleRetake}
        >
          <Text style={styles.buttonText}>Record another</Text>
        </Pressable>
      </View>
    );
  }

  // idle / recording: full-screen camera with controls overlaid on top
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        mode="video"
        videoQuality="720p"
      />
      <View
        style={[styles.overlay, { paddingBottom: 40 + insets.bottom }]}
        pointerEvents="box-none"
      >
        <Text style={styles.prompt}>{PROMPT_TEXT}</Text>
        {screenState === "recording" ? (
          <Pressable style={styles.recordButtonActive} onPress={handleStopRecording}>
            <View style={styles.stopIcon} />
          </Pressable>
        ) : (
          <Pressable style={styles.recordButton} onPress={handleStartRecording} />
        )}
      </View>
    </View>
  );
}

// Only mounted once a real video uri exists, so useVideoPlayer never has to
// deal with a null source (expo-video 57.0.0 has known rough edges there).
function VideoPreview({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <VideoView style={styles.preview} player={player} nativeControls />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  resultContainer: {
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  promptDark: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
  },
  // Sits on top of the full-screen camera preview; pointerEvents="box-none"
  // lets touches pass through to the camera except on the prompt/button.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: "center",
  },
  preview: {
    width: "100%",
    flex: 1,
  },
  prompt: {
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 24,
    fontSize: 17,
    fontWeight: "500",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heading: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  transcriptHeading: {
    marginTop: 28,
  },
  transcriptScroll: {
    flex: 1,
    marginBottom: 16,
  },
  transcriptText: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 22,
  },
  emptyStateText: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 8,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  checklistText: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    lineHeight: 21,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    backgroundColor: "#000",
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    marginVertical: 8,
    alignSelf: "center",
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  confirmButtonDone: {
    backgroundColor: "#166534",
  },
  buttonOutline: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  buttonOutlineText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
    textAlign: "center",
  },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#dc2626",
    borderWidth: 4,
    borderColor: "#fff",
  },
  recordButtonActive: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "#dc2626",
  },
});
