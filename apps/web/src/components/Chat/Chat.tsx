import React from 'react';
import useStore from '@store/store';

import ChatContent from './ChatContent';
import ChatHeader from './ChatHeader';
import MobileBar from '@components/MobileBar';
import ArtifactPanel from '@components/Artifact/ArtifactPanel';
import ImageStudio from '@components/Image/ImageStudio';
import ProjectPage from '@components/Project/ProjectPage';
import TechWaveBackground from '@components/Background/TechWaveBackground';
import AgentPanel from '@components/Agent/AgentPanel';
import AgentPicker from '@components/Agent/AgentPicker';
import { useLandscapeNativeApp } from '@utils/device';

const Chat = () => {
  const hideSideMenu = useStore((state) => state.hideSideMenu);
  const artifactPanelOpen = useStore((state) => state.artifactPanelOpen);
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);
  const closeArtifactPanel = useStore((state) => state.closeArtifactPanel);
  const imageMode = useStore((state) => state.imageMode);
  const projectMode = useStore((state) => state.projectMode);
  const standalonePage = imageMode || projectMode;
  const landscapeNative = useLandscapeNativeApp();

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, iframe')) return;
    setHideSideMenu(true);
    closeArtifactPanel();
  };

  return (
    <div
      className={`relative flex h-full flex-1 flex-col max-md:bg-surface dark:bg-[#0b0f0e] ${
        standalonePage
          ? 'md:pl-0'
          : landscapeNative
            ? hideSideMenu
              ? ''
              : 'pl-60'
            : hideSideMenu
              ? 'md:pl-0'
              : 'md:pl-64'
      } transition-all`}
    >
      <TechWaveBackground />
      <div className='pico-glow pointer-events-none absolute inset-0 overflow-hidden' />
      <MobileBar />
      <main className={`relative flex h-full w-full flex-1 flex-row gap-0 overflow-hidden px-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-0 sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]`}>
        <div
          onDoubleClick={handleDoubleClick}
          className={`relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-none border-0 bg-transparent transition-all duration-300 ease-in-out dark:!bg-transparent ${
            artifactPanelOpen ? 'md:w-[30%] md:flex-none' : 'flex-1'
          }`}
        >
          {projectMode ? (
            <ProjectPage />
          ) : imageMode ? (
            <ImageStudio />
          ) : (
            <>
              <ChatHeader />
              <ChatContent />
            </>
          )}
        </div>
        {artifactPanelOpen && <ArtifactPanel />}
      </main>
      <AgentPanel />
      <AgentPicker />
    </div>
  );
};

export default Chat;
