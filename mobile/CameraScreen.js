// CAPTURE layer. This screen's only job is to produce a video file and hand
// it to processVideo(). It must not know anything about transcription or
// extraction — that logic lives entirely behind the processVideo() seam so a
// future WhatsApp-based capture layer can call the exact same function.

import { useRef, useState } from "react";
import {
  Alert,
  Pressable,
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
import { processVideo } from "./processVideo";

const MAX_DURATION_SECONDS = 60;
const PROMPT_TEXT =
  "Tell us who you are, what you've built, and why you want to work at an early-stage startup.";

// Screen states: "idle" -> "recording" -> "preview" -> "processing" -> "done"
export default function CameraScreen() {
  const [screenState, setScreenState] = useState("idle");
  const [videoUri, setVideoUri] = useState(null);
  const [result, setResult] = useState(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef(null);

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
    setScreenState("idle");
  }

  async function handleUseVideo() {
    setScreenState("processing");
    try {
      // Hand off to the processing layer. The camera screen doesn't know or
      // care whether this ends up calling a local stub or a real backend.
      const extraction = await processVideo(videoUri);
      setResult(extraction);
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
      <View style={styles.container}>
        <Text style={styles.prompt}>
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
        <View style={styles.row}>
          <Pressable style={styles.buttonSecondary} onPress={handleRetake}>
            <Text style={styles.buttonText}>Retake</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={handleUseVideo}>
            <Text style={styles.buttonText}>Use this video</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (screenState === "processing") {
    return (
      <View style={styles.container}>
        <Text style={styles.prompt}>Uploading & processing your video…</Text>
      </View>
    );
  }

  if (screenState === "done" && result) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Extraction result (stub)</Text>
        <Text style={styles.mono}>{JSON.stringify(result, null, 2)}</Text>
        <Pressable style={styles.button} onPress={handleRetake}>
          <Text style={styles.buttonText}>Record another</Text>
        </Pressable>
      </View>
    );
  }

  // idle / recording: show live camera
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        mode="video"
      />
      <Text style={styles.prompt}>{PROMPT_TEXT}</Text>
      {screenState === "recording" ? (
        <Pressable style={styles.recordButtonActive} onPress={handleStopRecording}>
          <Text style={styles.buttonText}>Stop</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.recordButton} onPress={handleStartRecording}>
          <Text style={styles.buttonText}>Record</Text>
        </Pressable>
      )}
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
    alignItems: "center",
    justifyContent: "center",
  },
  camera: {
    width: "100%",
    flex: 1,
  },
  preview: {
    width: "100%",
    flex: 1,
  },
  prompt: {
    color: "#fff",
    textAlign: "center",
    padding: 16,
    fontSize: 16,
  },
  heading: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  mono: {
    color: "#0f0",
    fontFamily: "monospace",
    fontSize: 12,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 8,
  },
  buttonSecondary: {
    backgroundColor: "#374151",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#dc2626",
    marginBottom: 24,
  },
  recordButtonActive: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
