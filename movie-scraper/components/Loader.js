import { Skeleton } from "@mui/material";

export default function Loader() {
  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} variant="rectangular" height={60} animation="wave" className="mb-2 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
