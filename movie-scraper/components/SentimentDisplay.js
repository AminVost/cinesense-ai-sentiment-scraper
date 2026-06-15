export default function SentimentDisplay({ comment }) {
    return (
      <div
        className="list-group-item list-group-item-action p-3 shadow-sm rounded mb-2 text-end"
        style={{
          border: `2px solid ${comment.sentiment === "Positive" ? "#90ee90" : "#ffcccb"}`,
        }}
      >
        <p className="mb-0 text-white fw-semibold">{comment.text}</p>
        <small className="text-muted">
          Sentiment:{" "}
          <strong style={{ color: comment.sentiment === "Positive" ? "lightgreen" : "red" }}>
            {comment.sentiment}
          </strong>{" "}
          (Positive: {comment.positive}, Negative: {comment.negative})
        </small>
      </div>
    );
  }
  