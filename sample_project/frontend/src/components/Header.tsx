import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import ListIcon from '@mui/icons-material/FormatListBulleted';
import HouseIcon from "@/assets/icons/house.svg";
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountIcon from '@mui/icons-material/AccountCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import LanguageIcon from '@mui/icons-material/Language';
import ApartmentIcon from '@mui/icons-material/Apartment';
import VnFlag from '@/assets/icons/vnflag.svg';
import EnFlag from '@/assets/icons/enflag.svg';
import { useLocation, useNavigate } from 'react-router-dom';
import { BASE_PATH } from '@/utils/const';
import { Button, Popover, Typography } from '@mui/material';
import { useState, useContext, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AuthContext } from '@/contexts/AuthContext';
import authService from '@/services/auth/auth.service';
import i18n from '@/i18n';
import useTranslation from '@/hooks/use-translation';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [notiAnchor, setNotiAnchor] = useState<null | HTMLElement>(null);
  const notifOpen = Boolean(notiAnchor);
  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null);
  const accountOpen = Boolean(accountAnchor);
  const [langAnchor, setLangAnchor] = useState<null | HTMLElement>(null);
  const langOpen = Boolean(langAnchor);

  const [, authDispatch] = useContext(AuthContext);
  
  const handleChangeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setLangAnchor(null);
  };
  const handleBack = () => {
    if (location.pathname === BASE_PATH) return;
    navigate(-1);
  };

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      setAccountAnchor(null);
      authDispatch({ type: 'logout' });
      navigate('/auth/login');
    },
    onError: () => {
      setAccountAnchor(null);
      authDispatch({ type: 'logout' });
      navigate('/auth/login');
    },
  });

  const handleLogout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  return (
    <AppBar
      position="fixed"
      elevation={1}
      sx={{
        backgroundColor: '#144546',
        height: 60,
      }}
    >
      <Toolbar sx={{ minHeight: 60, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '27px', flex: 1, ml: 7 }}>
          <IconButton
            sx={{ width: 24, height: 24 }}
          >
            <ListIcon sx={{ fontSize: 24, color: 'white' }} />
          </IconButton>
          <IconButton
            onClick={handleBack}
            sx={{ width: 24, height: 24 }}
          >
            <ArrowBackIcon sx={{ fontSize: 24, color: 'white' }} />
          </IconButton>
          <IconButton
            onClick={() => navigate(BASE_PATH)}
            sx={{ width: 24, height: 24 }}
          >
            <img src={HouseIcon} alt="Home" style={{ width: 24, height: 24 }} />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, gap: 1 }}>
          <ApartmentIcon sx={{ color: '#4FC3F7', fontSize: 28 }} />
          <Typography
            variant="h6"
            sx={{
              color: 'white',
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            Smart Building
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '24px', flex: 1, mr: 7 }}>
          <IconButton 
            sx={{ width: 24, height: 24 }}
            onClick={(e) => setNotiAnchor(e.currentTarget)}
          >
            <NotificationsIcon sx={{ fontSize: 24, color: 'white', transform: 'rotate(45deg)', transformOrigin: 'center' }} />
          </IconButton>
          <Popover
            open={notifOpen}
            anchorEl={notiAnchor}
            onClose={() => setNotiAnchor(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            slotProps={{ paper: { sx: { width: 280, p: 1, mt: 1 } } }}
          >
            <Typography variant="subtitle1" fontWeight={600} mb={1}>{t('noti')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('no_noti')}</Typography>
          </Popover>

          <IconButton
            sx={{ width: 24, height: 24 }}
            onClick={(e) => setLangAnchor(e.currentTarget)}
          >
            <LanguageIcon sx={{ fontSize: 24, color: 'white' }} />
          </IconButton>
          <Popover
            open={langOpen}
            anchorEl={langAnchor}
            onClose={() => setLangAnchor(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            slotProps={{ paper: { sx: { width: 150, p: 1, mt: 1 } } }}
          >
            <Button
              fullWidth
              onClick={() => handleChangeLanguage('vi')}
              sx={{ justifyContent: 'flex-start', textTransform: 'none', fontSize: 16 }}
              color={i18n.language === 'vi' ? 'primary' : 'inherit'}
            >
              <img src={VnFlag} alt="Vietnamese" style={{ width: 20, height: 20, marginRight: 8 }} />
              Tiếng Việt
            </Button>
            <Button
              fullWidth
              onClick={() => handleChangeLanguage('en')}
              sx={{ justifyContent: 'flex-start', textTransform: 'none', fontSize: 16 }}
              color={i18n.language === 'en' ? 'primary' : 'inherit'}
            >
              <img src={EnFlag} alt="English" style={{ width: 20, height: 20, marginRight: 8 }} />
              English
            </Button>
          </Popover>

          <IconButton
            sx={{ width: 24, height: 24 }}
            onClick={(e) => setAccountAnchor(e.currentTarget)}
          >
            <AccountIcon sx={{ fontSize: 24, color: 'white' }} />
          </IconButton>
          <Popover
            open={accountOpen}
            anchorEl={accountAnchor}
            onClose={() => setAccountAnchor(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            slotProps={{ paper: { sx: { width: 200, p: 1, mt: 1 } } }}
          >
            <Button 
              fullWidth 
              startIcon={<PersonIcon />}
              sx={{ justifyContent: 'flex-start', textTransform: 'none', fontSize: 16 }} 
              onClick={() => setAccountAnchor(null)}
            >
              {t('profile')}
            </Button>
            <Button 
              fullWidth
              startIcon={<LogoutIcon />} 
              sx={{ justifyContent: 'flex-start', textTransform: 'none', fontSize: 16 }} 
              color="error"
              onClick={handleLogout}
            >
              {t('logout')}
            </Button>
          </Popover>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
