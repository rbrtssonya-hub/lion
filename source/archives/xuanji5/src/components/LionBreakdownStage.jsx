import './lion-breakdown.css';

export default function LionBreakdownStage({ part, breakdown, style, onOpen }) {
  if (!part || !breakdown) return null;

  return <aside className="lion-breakdown-stage" style={style} aria-label={`${part.name}信息可视化图版`}>
    <button
      className="lion-breakdown-image-button"
      type="button"
      aria-label={`打开${part.name}文化讲解`}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <img src={breakdown.image} alt="" aria-hidden="true" draggable="false" />
    </button>
  </aside>;
}
