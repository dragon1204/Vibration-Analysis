import { yupResolver } from '@hookform/resolvers/yup';
import { Box, Link, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useContext } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import * as yup from 'yup';

import BuildingBg from '@/assets/images/SmartBuilding.jpg';
import LoadingButton from '@/components/button/loading-button';
import CheckboxLabel from '@/components/field/checkbox-label';
import PasswordInput from '@/components/field/password-input';
import SelectChangeLocale from '@/components/field/select-change-locale';
import { AuthContext } from '@/contexts/AuthContext';
import useTranslation from '@/hooks/use-translation';
import i18n from '@/i18n';
import appService from '@/services/app/app.service';
import type { ILoginInput } from '@/services/auth/auth.model';
import authService from '@/services/auth/auth.service';

const loginSchema = yup.object({
  email: yup.string().email().required(i18n.t('email-required')),
  password: yup.string().required(i18n.t('password-required')),
});

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, dispatch] = useContext(AuthContext);
  const { enqueueSnackbar } = useSnackbar();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(loginSchema),
    mode: 'onChange',
  });

  const formWatch = useWatch({ control });

  const { mutate, isPending: loginLoading } = useMutation({
    mutationFn: (data: ILoginInput) => authService.login(data),
    onSuccess: (userData) => {
      dispatch({ type: 'setIsAuth', payload: true });
      dispatch({ type: 'setCurrentUser', payload: userData });

      appService.hideLoadingModal();
      enqueueSnackbar(t('login_success'), { variant: 'success' });

      navigate('/');
    },
    onError: (err: any) => {
      appService.hideLoadingModal();

      let errorMessage = t('error_occurred');

      if (err.response) {
        // Server responded with error status
        const status = err.response.status;
        const errorDetails =
          err.response.data?.error?.details || err.response.data?.message;

        if (status === 401 || status === 400) {
          errorMessage = 'Sai tên đăng nhập hoặc mật khẩu';
        } else if (errorDetails) {
          errorMessage = errorDetails;
        }
      } else if (err.request) {
        errorMessage = 'Có lỗi xảy ra. Vui lòng kiểm tra kết nối mạng';
      }

      enqueueSnackbar(errorMessage, {
        variant: 'error',
      });
    },
  });

  const onSubmit = (data: ILoginInput) => {
    mutate(data);
    appService.showLoadingModal();
  };

  return (
    <Box
      sx={{
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'background.paper',
        flex: '1 1 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${BuildingBg})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }}
      ></Box>
      <Box
        sx={{
          maxWidth: 550,
          px: 3,
          pt: 4,
          pb: 6,
          width: '100%',
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderRadius: 1,
          zIndex: 1,
          position: 'relative',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translate(-50%,-100%)',
            fontSize: 28,
          }}
        >
          {formWatch?.tenancyName || ''}
        </Typography>
        <div>
          <Stack
            spacing={1}
            sx={{
              mb: 3,
              position: 'relative',
              '.btn-locale': {
                position: 'absolute',
                top: 0,
                right: 0,
                mt: 0,
              },
            }}
          >
            <Typography variant="h4">{t('login')}</Typography>
            <SelectChangeLocale
              buttonProps={{
                className: 'btn-locale',
                size: 44,
                style: {
                  fontSize: 26,
                },
              }}
            />
          </Stack>

          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              fullWidth
              label={t('user_name_or_email')}
              error={!!errors.email?.message}
              helperText={errors.email?.message}
              disabled={loginLoading}
              required
              margin="dense"
              style={{ marginBottom: 12 }}
              {...register('email')}
            />

            <PasswordInput
              fullWidth
              label={t('password')}
              error={!!errors.password?.message}
              helperText={errors.password?.message}
              disabled={loginLoading}
              required
              margin="dense"
              style={{ marginBottom: 12 }}
              {...register('password')}
            />

            <Stack
              direction={'row'}
              alignItems={'center'}
              justifyContent={'space-between'}
              style={{ marginBottom: 20 }}
            >
              <CheckboxLabel
                label={
                  <Typography variant="subtitle2">
                    {t('remember_me')}
                  </Typography>
                }
                disabled={loginLoading}
                size="small"
              />
              <Link
                href="/auth/forgot-password"
                underline="hover"
                variant="subtitle2"
              >
                {t('forgot_password')}?
              </Link>
            </Stack>

            <LoadingButton
              fullWidth
              size="large"
              type="submit"
              variant="contained"
              loading={loginLoading}
            >
              {t('login')}
            </LoadingButton>
          </form>
        </div>
      </Box>
    </Box>
  );
};

export default LoginPage;
