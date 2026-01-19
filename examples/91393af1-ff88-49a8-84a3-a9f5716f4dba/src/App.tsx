import React, { useState } from 'react';
import { Utensils, DicesIcon, HeartIcon, ChefHat } from 'lucide-react';

const foodOptions = {
  中餐: [
    '红烧肉', '麻婆豆腐', '宫保鸡丁', '水煮鱼', 
    '回锅肉', '糖醋里脊', '炸酱面', '火锅',
    '小龙虾', '烤鸭', '酸菜鱼', '葱爆羊肉'
  ],
  快餐: [
    '汉堡', '炸鸡', '披萨', '意大利面',
    '三明治', '卷饼', '煎饼果子', '肯德基'
  ],
  面食: [
    '兰州拉面', '阳春面', '重庆小面', '担担面',
    '牛肉面', '麻辣烫', '刀削面', '炸酱面'
  ],
  其他: [
    '寿司', '韩式烤肉', '咖喱饭', '泰式炒饭',
    '越南河粉', '印度咖喱', '墨西哥卷饼', '烤肉饭'
  ]
};

function App() {
  const [recommendation, setRecommendation] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof foodOptions | ''>('');

  const getRandomFood = () => {
    setIsSpinning(true);
    let options = selectedCategory 
      ? foodOptions[selectedCategory]
      : Object.values(foodOptions).flat();
    
    // 添加渐变动画效果
    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * options.length);
      setRecommendation(options[randomIndex]);
      count++;
      
      if (count > 10) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 80);
  };

  const toggleFavorite = (food: string) => {
    if (favorites.includes(food)) {
      setFavorites(favorites.filter(f => f !== food));
    } else {
      setFavorites([...favorites, food]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-amber-50 p-4 sm:p-8">
      <div className="max-w-md mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="text-center mb-8 relative">
          <div className="flex justify-center items-center mb-4">
            <div className="relative">
              <Utensils className="w-16 h-16 text-orange-500" />
              <ChefHat className="w-8 h-8 text-orange-400 absolute -top-2 -right-2 transform rotate-12" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3 font-serif">今晚吃什么？</h1>
          <p className="text-gray-600">让我来帮你决定吧！</p>
          <div className="absolute w-32 h-32 bg-orange-100 rounded-full -z-10 blur-3xl opacity-60 -top-10 -left-16" />
          <div className="absolute w-32 h-32 bg-red-100 rounded-full -z-10 blur-3xl opacity-60 -bottom-10 -right-16" />
        </div>

        <div className="mb-6 relative">
          <label className="block text-gray-700 mb-2 font-medium">选择分类（可选）：</label>
          <div className="relative">
            <select 
              className="w-full p-3 border border-orange-200 rounded-xl bg-white/50 backdrop-blur-sm appearance-none hover:border-orange-300 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as keyof typeof foodOptions | '')}
            >
              <option value="">全部类型</option>
              {Object.keys(foodOptions).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <button
          onClick={getRandomFood}
          disabled={isSpinning}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 px-6 rounded-xl mb-6 transition duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-orange-500/30 flex items-center justify-center gap-3"
        >
          <DicesIcon className={`w-6 h-6 ${isSpinning ? 'animate-spin' : ''}`} />
          开始随机
        </button>

        {recommendation && (
          <div className="text-center mb-8 transform animate-fade-in">
            <div className="text-xl font-medium text-gray-700 mb-3">
              推荐你吃：
            </div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500 mb-4">
              {recommendation}
            </div>
            <button
              onClick={() => toggleFavorite(recommendation)}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-red-500 transition-colors px-4 py-2 rounded-lg hover:bg-red-50"
            >
              <HeartIcon 
                className={`w-5 h-5 transition-all duration-300 transform hover:scale-110 ${
                  favorites.includes(recommendation) ? 'fill-red-500 text-red-500' : ''
                }`} 
              />
              {favorites.includes(recommendation) ? '取消收藏' : '收藏'}
            </button>
          </div>
        )}

        {favorites.length > 0 && (
          <div className="border-t border-orange-100 pt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <HeartIcon className="w-5 h-5 text-red-500" />
              我的收藏
            </h3>
            <div className="flex flex-wrap gap-2">
              {favorites.map(food => (
                <span 
                  key={food}
                  className="bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  {food}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;