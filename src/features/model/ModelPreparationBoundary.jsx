import { Component } from 'react';
import { media } from '../../config/media.js';

export default class ModelPreparationBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onReady?.(false); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="model-stage" id="modelStage" aria-label="醒狮整体与结构">
      <img className="model-fallback" id="modelFallback" src={media.poster} alt="醒狮整体参考图" />
      <div className="loading-panel" role="status">
        <span id="modelStatus">模型组件未能准备 · 保留结构预览</span>
        <button type="button" onClick={() => window.location.reload()}>重新载入</button>
      </div>
    </section>;
  }
}
