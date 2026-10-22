"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import LandingPage from "@/components/LandingPage";
import { ChatModeConfig } from "@/types";

// Keep document, math, code and diagram renderers out of the landing-page bundle.
const ChatInterface = dynamic(() => import("@/components/ChatInterface"), {
  loading: () => <main id="main-content" className="site-container py-20" role="status">Membuka ruang percakapan…</main>,
});

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<ChatModeConfig | null>(null);

  const handleSelectMode = (mode: ChatModeConfig) => {
    setSelectedMode(mode);
  };

  const handleBack = () => {
    setSelectedMode(null);
  };

  if (selectedMode) {
    return (
      <ChatInterface
        key={selectedMode.id}
        mode={selectedMode.id}
        modeTitle={selectedMode.title}
        onBack={handleBack}
      />
    );
  }

  return <LandingPage onSelectMode={handleSelectMode} />;
}
