import React from 'react';

const SkeletonPreview = () => (
  <div className="space-y-8 animate-pulse">
    <div>
      <div className="h-8 w-3/4 bg-gray-700 rounded-md mb-4"></div>
      <div className="bg-gray-700/80 p-4 rounded-lg">
        <div className="h-4 w-1/3 bg-gray-600 rounded-md mb-3"></div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-gray-600 rounded-md"></div>
          <div className="h-3 w-5/6 bg-gray-600 rounded-md"></div>
           <div className="h-3 w-full bg-gray-600 rounded-md"></div>
        </div>
      </div>
    </div>
    <div className="bg-gray-700/80 rounded-lg">
       <div className="h-12 w-full bg-gray-700/50 rounded-t-lg"></div>
       <div className="p-4"><div className="h-20 w-full bg-gray-600 rounded-md"></div></div>
    </div>
     <div className="bg-gray-700/80 rounded-lg">
       <div className="h-12 w-full bg-gray-700/50 rounded-t-lg"></div>
    </div>
      <div className="bg-gray-700/80 rounded-lg">
       <div className="h-12 w-full bg-gray-700/50 rounded-t-lg"></div>
    </div>
  </div>
);

export default SkeletonPreview;
