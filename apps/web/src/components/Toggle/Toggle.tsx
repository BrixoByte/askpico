import React from 'react';

const Toggle = ({
  label,
  isChecked,
  setIsChecked,
}: {
  label: string;
  isChecked: boolean;
  setIsChecked: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <label className='relative flex min-h-[48px] items-center cursor-pointer'>
      <input
        type='checkbox'
        className='sr-only peer'
        checked={isChecked}
        onChange={() => {
          setIsChecked((prev) => !prev);
        }}
      />
      <div className="relative w-9 h-5 bg-gray-200 dark:bg-zinc-700 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:bg-[#8AE000] dark:peer-checked:bg-[#9EFF00]"></div>
      <span className='ml-3 text-sm font-medium text-gray-900 dark:text-zinc-400'>
        {label}
      </span>
    </label>
  );
};

export default Toggle;
