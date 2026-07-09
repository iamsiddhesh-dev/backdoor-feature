import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import CameraScreen from "./CameraScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <CameraScreen />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
