import { Box } from "@mui/material"

const ScanLine = () => {
    return (
      <div>
        <Box
          sx={{
            position: "absolute",
            top: "-5%",
            left: 0,
            width: "100%",
            height: "1px", 
            backgroundColor: "#00e5ff",
            animation: "scanLineVertical 8s linear infinite",
            opacity: 0.12,
            boxShadow: "0 0 8px rgba(0, 229, 255, 0.5)",
            pointerEvents: "none",
          }}
        />
  
        <style>
        {`
          @keyframes scanLineVertical {
          0% { transform: translateY(0); }
          100% { transform: translateY(110vh); }
          }
        `}
        </style>
      </div>
    )
}

export default ScanLine;    