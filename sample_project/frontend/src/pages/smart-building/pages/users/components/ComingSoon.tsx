import { Box, Typography } from "@mui/material";
import { Construction } from "lucide-react";

interface ComingSoonProps {
  feature?: string;
}

const ComingSoon = ({ feature }: ComingSoonProps) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: 320,
      gap: 2,
      bgcolor: "rgba(2, 6, 23, 0.85)",
      backdropFilter: "blur(16px)",
      borderRadius: 3,
      border: "1px solid rgba(255,255,255,0.08)",
    }}
  >
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        bgcolor: "rgba(0,200,255,0.1)",
        border: "1px solid rgba(0,200,255,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Construction size={24} color="#00c8ff" />
    </Box>

    <Box sx={{ textAlign: "center" }}>
      <Typography
        sx={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", mb: 0.75 }}
      >
        {feature ?? "Tính năng đang phát triển"}
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#64748b" }}>
        Chức năng này sẽ sớm được ra mắt. Vui lòng quay lại sau.
      </Typography>
    </Box>
  </Box>
);

export default ComingSoon;
