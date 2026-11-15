import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';

import CrossIcon2 from '@icon/CrossIcon2';

const PopupModal = ({
  title = 'Information',
  message,
  setIsModalOpen,
  handleConfirm,
  handleClose,
  handleClickBackdrop,
  cancelButton = true,
  children,
}: {
  title?: string;
  message?: string;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleConfirm?: () => void;
  handleClose?: () => void;
  handleClickBackdrop?: () => void;
  cancelButton?: boolean;
  children?: React.ReactElement;
}) => {
  const modalRoot = document.getElementById('modal-root');
  const { t } = useTranslation();

  const _handleClose = () => {
    handleClose && handleClose();
    setIsModalOpen(false);
  };

  const _handleBackdropClose = () => {
    if (handleClickBackdrop) handleClickBackdrop();
    else _handleClose();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (handleClickBackdrop) handleClickBackdrop();
      else handleClose ? handleClose() : setIsModalOpen(false);
    } else if (event.key === 'Enter') {
      if (handleConfirm) handleConfirm();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleConfirm, handleClose, handleClickBackdrop]);

  if (modalRoot) {
    return ReactDOM.createPortal(
      <div className='fixed top-0 left-0 z-[999] w-full p-4 overflow-x-hidden overflow-y-auto h-full flex justify-center items-center'>
        <div className='relative z-2 flex w-[92vw] max-w-md h-auto max-h-[85vh] sm:w-[70vw] sm:max-w-none sm:h-[70vh] justify-center mx-auto'>
          <div className='relative flex w-full flex-col rounded-2xl border border-gray-200 bg-gray-50 shadow dark:border-zinc-800/80 dark:bg-[#121316] dark:shadow-2xl overflow-hidden hide-scroll-bar'>
            <div className='flex items-center justify-between p-4 border-b rounded-t dark:border-zinc-800/80'>
              <h3 className='ml-2 text-lg font-semibold text-gray-900 dark:text-zinc-100'>
                {title}
              </h3>
              <button
                type='button'
                className='text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-full text-sm p-1.5 ml-auto inline-flex items-center transition-colors dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                onClick={_handleClose}
                aria-label='close modal'
              >
                <CrossIcon2 />
              </button>
            </div>

            {message && (
              <div className='p-4 sm:p-6 border-b border-gray-200 dark:border-zinc-800/80'>
                <div className='min-w-fit text-gray-900 dark:text-zinc-400 text-sm mt-4'>
                  {message}
                </div>
              </div>
            )}

            <div className='flex-1 overflow-y-auto'>{children}</div>

            <div className='flex flex-wrap max-sm:flex-col items-center justify-center p-4 sm:p-6 gap-3 sm:gap-4'>
              {handleConfirm && (
                <button
                  type='button'
                  className='btn btn-primary max-sm:w-full !rounded-full px-4 py-2 dark:!text-black dark:hover:!bg-[#86D900]'
                  onClick={handleConfirm}
                  aria-label='confirm'
                >
                  {t('confirm')}
                </button>
              )}
              {cancelButton && (
                <button
                  type='button'
                  className='btn max-sm:w-full !rounded-xl border border-gray-300 !bg-transparent px-4 py-2 text-gray-700 hover:bg-gray-100 dark:!border-zinc-700 dark:!bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800'
                  onClick={_handleClose}
                  aria-label='cancel'
                >
                  {t('cancel')}
                </button>
              )}
            </div>
          </div>
        </div>
        <div
          className='bg-black/70 backdrop-blur-sm absolute top-0 left-0 h-full w-full z-[-1]'
          onClick={_handleBackdropClose}
        />
      </div>,
      modalRoot
    );
  } else {
    return null;
  }
};

export default PopupModal;
