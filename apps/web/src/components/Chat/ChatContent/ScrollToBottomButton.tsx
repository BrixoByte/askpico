import React from 'react';
import { useAtBottom, useScrollToBottom } from 'react-scroll-to-bottom';

import DownArrow from '@icon/DownArrow';

const ScrollToBottomButton = React.memo(() => {
  const scrollToBottom = useScrollToBottom();
  const [atBottom] = useAtBottom();

  return (
    <button
      className={`cursor-pointer absolute right-3 bottom-3 md:right-6 md:bottom-4 z-10 scale-90 md:scale-100 rounded-full border border-gray-200 bg-gray-50 p-1.5 md:p-2 text-gray-600 shadow-card dark:border-white/10 dark:bg-surface/10 dark:text-gray-200 ${
        atBottom ? 'hidden' : ''
      }`}
      aria-label='scroll to bottom'
      onClick={scrollToBottom}
    >
      <DownArrow />
    </button>
  );
});

export default ScrollToBottomButton;
