import { Box, Typography } from "@mui/material";

interface InfoRowProps {
  label: string;
  value: string | React.ReactNode;
}

const InfoRow = ({ label, value }: InfoRowProps) => {
  return (
    <Box
      sx={{
        height: 45,
        px: 2,
        borderRadius: 3,
        background: "linear-gradient(180deg, #1B2537 0%, #162033 100%)",
        border: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        mb: 0.2,
      }}
    >
      <Typography
        sx={{
          fontSize: 14,
          color: "#94A3B8",
          fontWeight: 250,
        }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          fontSize: 13,
          color: "#FFFFFF",
          fontWeight: 500,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

export default InfoRow;
