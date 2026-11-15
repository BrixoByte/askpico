import { StoreApi, create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatSlice, createChatSlice } from './chat-slice';
import { InputSlice, createInputSlice } from './input-slice';
import { AuthSlice, createAuthSlice } from './auth-slice';
import { ConfigSlice, createConfigSlice } from './config-slice';
import { PromptSlice, createPromptSlice } from './prompt-slice';
import { ToastSlice, createToastSlice } from './toast-slice';
import { ArtifactSlice, createArtifactSlice } from './artifact-slice';
import { ImageSlice, createImageSlice } from './image-slice';
import { AgentSlice, createAgentSlice } from './agent-slice';
import {
  LocalStorageInterfaceV0ToV1,
  LocalStorageInterfaceV1ToV2,
  LocalStorageInterfaceV2ToV3,
  LocalStorageInterfaceV3ToV4,
  LocalStorageInterfaceV4ToV5,
  LocalStorageInterfaceV5ToV6,
  LocalStorageInterfaceV6ToV7,
  LocalStorageInterfaceV7oV8,
  LocalStorageInterfaceV8ToV9,
} from '@type/chat';
import {
  migrateV0,
  migrateV1,
  migrateV2,
  migrateV3,
  migrateV4,
  migrateV5,
  migrateV6,
  migrateV7,
  migrateV8,
  migrateV9,
} from './migrate';

export type StoreState = ChatSlice &
  InputSlice &
  AuthSlice &
  ConfigSlice &
  PromptSlice &
  ToastSlice &
  ArtifactSlice &
  ImageSlice &
  AgentSlice;

export type StoreSlice<T> = (
  set: StoreApi<StoreState>['setState'],
  get: StoreApi<StoreState>['getState']
) => T;

export const createPartializedState = (state: StoreState) => ({
  chats: state.chats,
  apiKey: state.apiKey,
  apiEndpoint: state.apiEndpoint,
  theme: state.theme,
  autoTitle: state.autoTitle,
  advancedMode: state.advancedMode,
  prompts: state.prompts,
  defaultChatConfig: state.defaultChatConfig,
  defaultSystemMessage: state.defaultSystemMessage,
  hideMenuOptions: state.hideMenuOptions,
  firstVisit: state.firstVisit,
  folders: state.folders,
  enterToSubmit: state.enterToSubmit,
  replyLanguage: state.replyLanguage,
  inlineLatex: state.inlineLatex,
  markdownMode: state.markdownMode,
  totalTokenUsed: state.totalTokenUsed,
  countTotalTokens: state.countTotalTokens,
  artifacts: state.artifacts,
  activeArtifactId: state.activeArtifactId,
  activeArtifactTab: state.activeArtifactTab,
  studioItems: state.studioItems,
  scratchpadItems: state.scratchpadItems,
  reminders: state.reminders,
});

const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...createChatSlice(set, get),
      ...createInputSlice(set, get),
      ...createAuthSlice(set, get),
      ...createConfigSlice(set, get),
      ...createPromptSlice(set, get),
      ...createToastSlice(set, get),
      ...createArtifactSlice(set, get),
      ...createImageSlice(set, get),
      ...createAgentSlice(set, get),
    }),
    {
      name: 'free-chat-gpt',
      partialize: (state) => createPartializedState(state),
      version: 10,
      migrate: (persistedState, version) => {
        switch (version) {
          case 0:
            migrateV0(persistedState as LocalStorageInterfaceV0ToV1);
          case 1:
            migrateV1(persistedState as LocalStorageInterfaceV1ToV2);
          case 2:
            migrateV2(persistedState as LocalStorageInterfaceV2ToV3);
          case 3:
            migrateV3(persistedState as LocalStorageInterfaceV3ToV4);
          case 4:
            migrateV4(persistedState as LocalStorageInterfaceV4ToV5);
          case 5:
            migrateV5(persistedState as LocalStorageInterfaceV5ToV6);
          case 6:
            migrateV6(persistedState as LocalStorageInterfaceV6ToV7);
          case 7:
            migrateV7(persistedState as LocalStorageInterfaceV7oV8);
          case 8:
            migrateV8(persistedState as LocalStorageInterfaceV8ToV9);
          case 9:
            migrateV9(persistedState as LocalStorageInterfaceV8ToV9);
            break;
        }
        return persistedState as StoreState;
      },
    }
  )
);

const ACTIVE_CHAT_KEY = 'pico-active-chat-id';

const restoreActiveChat = () => {
  const { chats, currentChatIndex, setCurrentChatIndex } = useStore.getState();
  if (!chats?.length) return;
  const savedId = sessionStorage.getItem(ACTIVE_CHAT_KEY);
  const saved = savedId ? chats.findIndex((chat) => chat.id === savedId) : -1;
  const index = saved >= 0 ? saved : 0;
  if (currentChatIndex !== index) setCurrentChatIndex(index);
};

restoreActiveChat();

useStore.subscribe((state) => {
  const id = state.chats?.[state.currentChatIndex]?.id;
  if (id) sessionStorage.setItem(ACTIVE_CHAT_KEY, id);
});

export const closeActiveChat = () => {
  sessionStorage.removeItem(ACTIVE_CHAT_KEY);
  window.history.replaceState(null, '', '/');
  useStore.getState().setCurrentChatIndex(-1);
};

export default useStore;
