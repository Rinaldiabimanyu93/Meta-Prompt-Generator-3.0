import React from 'react';
import { SparklesIcon } from './icons';

const Placeholder = () => (
  <div className="flex h-full min-h-[50vh] items-center justify-center rounded-2xl border-2 border-dashed border-gray-600 bg-gray-800/30 p-8">
    <div className="text-center">
      <SparklesIcon className="mx-auto h-12 w-12 text-gray-500" />
      <h3 className="mt-4 text-lg font-medium text-gray-400">Hasil akan muncul di sini</h3>
      <p className="mt-1 text-sm text-gray-500">Gunakan "Isi Cepat dengan AI" atau isi formulir untuk memulai.</p>
    </div>
  </div>
);

export default Placeholder;
