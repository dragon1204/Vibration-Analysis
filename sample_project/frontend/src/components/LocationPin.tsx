import { Box } from "@mui/material";
import LocationPinIcon from "@mui/icons-material/LocationPin";

const LocationPin = ({
  color = "#ffffff",
  width = 18,
  height = 28,
}) => {
  return (
    <Box
      sx={{
        position: "relative",
        width,
        height,
        flexShrink: 0,
      }}
    >
      {/* Pin */}
      <LocationPinIcon
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          fontSize: height,
          color,
          transform: "translate(-50%, -50%) scale(1.18)",
        }}
      />

      {/* White dot — căn chuẩn tâm lỗ pin */}
      <Box
        sx={{
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: "#fff",
          left: "50%",
          top: "37%",                 
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />
    </Box>
  );
};

export default LocationPin;
