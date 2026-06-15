import SentimentDisplay from "./SentimentDisplay";
import Loader from "./Loader";

export default function CommentList({ comments, loading }) {
  if (loading) return <Loader />;

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="list-group">
            {comments.length > 0 ? (
              comments.map((comment, index) => <SentimentDisplay key={index} comment={comment} />)
            ) : (
              <div className="alert alert-info text-center">No comments found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
